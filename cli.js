#!/usr/bin/env node

require('isomorphic-fetch')
const fs = require('fs')
const path = require('path')
const minimist = require('minimist')
const inquirer = require('inquirer')
const RegClient = require('npm-registry-client')

const version = require('./package.json').version

const args = minimist(process.argv.slice(2))

// Print help
if (args.help === true || args.h === true) {
  printHelp()
  process.exit()
}

const noop = () => {}
const logger = {
  error: noop,
  warn: noop,
  info: noop,
  verbose: noop,
  debug: noop,
  silly: noop,
  http: noop,
}

const npmClient = new RegClient({ log: logger })

function run() {
  const [command, ...options] = args._

  if (command === 'copy') {
    copy(options)
  }
  else if (command === 'summon') {
    summon()
  }
  else if (command === 'help') {
    printHelp()
    process.exit(0)
  }
  else {
    console.log(`\n  ${command} ain't no command of ours.\n`)
    printHelp()
    process.exit(0)
  }
}

function printHelp() {
  console.log(`
  Usage:
    nsm copy [package] [source] [destination] [--save]
    nsm summon
    nsm help
  `)
}

async function getPackageGitInfo(packageName) {
  return new Promise((resolve, reject) => {
    const uri = `https://registry.npmjs.org/${packageName}`
    const results = npmClient.get(uri, {
      headers: {
        Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
      },
    }, (err, results) => {
      if (err) {
        return reject(err)
      }
      const repoSshUrl = results.repository.url
      const [, owner, repo] = repoSshUrl.split(/github\.com\/([^/]+)\/([^.]+)\.git$/)
      resolve({ owner, repo })
    })
  })
}

async function getFilesInRepo(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`

  const results = await fetch(url, {
    headers: {
      Accept: `application/vnd.github.v3+json`,
    },
  })

  const jsonResults = await results.json()
  return jsonResults.tree
}

async function getFileContentInRepo(owner, repo, filePath) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

  const results = await fetch(url, {
    headers: {
      Accept: `application/vnd.github.v3+json`,
    },
  })

  const { content, encoding } = await results.json()
  const asciiResults = new Buffer(content, encoding).toString('ascii')
  return asciiResults
}

async function writeContentsToFile(destination, contents) {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(destination, contents, (err => {
      if (err) {
        reject(err)
      }
      else {
        resolve()
      }
    }))
  })
}

/**
 * Copies a file from a package's repo and writes it to a given
 * destination, optionally saving a reference to this action into
 * package.json
 */
async function copy(options) {
  let [packageName, source, destination] = options

  // Package name -> owner/repo
  if (packageName === undefined) {
    const packageNameInput = await inquirer.prompt([
      {
        name: 'packageName',
        type: 'input',
        message: 'What package do you want to copy from?',
      },
    ])
    packageName = packageNameInput.packageName
  }

  const { owner, repo } = await getPackageGitInfo(packageName)
  const repoFiles = await getFilesInRepo(owner, repo)
  const jsFiles = repoFiles.filter(file => /\.js$/.test(file.path)).map(file => file.path)

  // Source
  if (source === undefined) {
    const sourceInput = await inquirer.prompt([
      {
        name: 'source',
        type: 'list',
        message: 'Which file do you want to copy?',
        choices: jsFiles,
      },
    ])
    source = sourceInput.source
  }

  const fileContent = await getFileContentInRepo(owner, repo, source)

  // Destination
  if (destination === undefined) {
    const destinationInput = await inquirer.prompt([
      {
        name: 'destination',
        type: 'input',
        message: 'Where do you want to copy the contents?',
        default: path.basename(source),
      }
    ])
    destination = destinationInput.destination
  }

  await fs.writeFileSync(destination, fileContent)

  console.log(`Wrote ${fileContent.length} bytes worth of juicy JavaScript to ${destination}. Enjoy!`)

  // Write to snippets list in package.json
  if (args.save) {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    if (packageJson.snippets === undefined) {
      packageJson.snippets = {}
    }

    packageJson.snippets[`${owner}/${repo}:${source}`] = destination
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  }
}

/**
 * Reads saved snippets from package.json and downloads them all 
 * into their defined destinations.
 */
async function summon() {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  const snippets = packageJson.snippets || {}
  const sources = Object.keys(snippets)

  console.log('Summoning snippets...\n')

  for (let i = 0; i < sources.length; i++) {
    const [, owner, repo, source] = sources[i].split(/^([^/]+)\/([^:]+):(.+)$/)
    const destination = snippets[sources[i]]
    const fileContent = await getFileContentInRepo(owner, repo, source)
    await fs.writeFileSync(destination, fileContent)
    console.log(`...copied ${source} from ${owner}/${repo} to ${destination}.`)
  }

  console.log('\nDone!')
}

run()