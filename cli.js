#!/usr/bin/env node

require('isomorphic-fetch')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const RegClient = require('npm-registry-client')

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

async function run() {
  const { packageName } = await inquirer.prompt([
    {
      name: 'packageName',
      type: 'input',
      message: 'What package do you want to copy from?',
    },
  ])

  const { owner, repo } = await getPackageGitInfo(packageName)
  const repoFiles = await getFilesInRepo(owner, repo)
  const jsFiles = repoFiles.filter(file => /\.js$/.test(file.path)).map(file => file.path)

  const { file } = await inquirer.prompt([
    {
      name: 'file',
      type: 'list',
      message: 'Which file do you want to copy?',
      choices: jsFiles,
    },
  ])

  const fileContent = await getFileContentInRepo(owner, repo, file)

  const { destination } = await inquirer.prompt([
    {
      name: 'destination',
      type: 'input',
      message: 'Where do you want to copy the contents?',
      default: path.basename(file),
    }
  ])
  await fs.writeFileSync(destination, fileContent)

  console.log(`Wrote ${fileContent.length} bytes worth of juicy JavaScript to ${destination}. Enjoy!`)
}

run()