# nsm

> The copy-paste version of the npm CLI

**`nsm`** (npm snippet manager) is a thingy that lets you copy any JavaScript file from any package (that specifies a GitHub repository) published to npm, directly from the command line.

![nsm in action](nsm-in-action.gif)

## Why though?

Here are a couple of loose ideas on its use cases:

* You know of an implementation in a library's examples that you always want to steal
* You want a centralized documentation on where code has been copy-pasted from
* You wish to be dependency free (well, officially, since copying code in this manner is kind of a dependency)
* You don't really feel like installing a dependency that is a one-liner
* You want to save random useful and reusable files in a library somewhere and easily copy them over without using Yeoman et al

## Installation

```sh
npm install -g nsm-cli
```

## Usage

```sh
$ nsm help

  Usage:
    nsm copy [package] [source] [destination] [--save]
    nsm summon
    nsm help
```

## Commands

### `copy`

Copies a file from a package's repo and writes it to a given destination. Omitted arguments are queried using prompts.

If the `--save` option is specified (at the end), a reference will be stored in a `snippets` collection in package.json.

```sh
nsm copy [package] [source] [destination] [--save]
```

### `summon`

Downloads all files listed in the `snippets` collection in package.json and writes them to their defined destinations.

```sh
nsm summon
```