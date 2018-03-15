#!/usr/bin/env node

var fs = require('fs')
var pkg = require('package-repo')
var path = require('path')
var ghreleases = require('ghreleases')
var tar = require('tar-fs')
var unzip = require('unzip')
var request = require('request')
var rimraf = require('rimraf')

if (process.argv[2] === 'init') {
  prompt('Enter encrypted github token for travis:', function (travis) {
    prompt('Enter encrypted github token for appveyor:', function (appveyor) {
      init({travis, appveyor})
    })
  })
} else if (process.argv[2] === 'download') {
  download()
} else {
  console.error('Usage: prebuildify-ci init|download')
  process.exit(1)
}

function prompt (prefix, cb) {
  console.log(prefix)
  process.stdin.once('data', function (data) {
    process.stdin.pause()
    cb(data.toString().trim())
  })
  process.stdin.resume()
}

function init (opts) {
  var wrote = []
  if (opts.travis) {
    wrote.push('.travis.yml')
    fs.writeFileSync('.travis.yml', travis(opts.travis))
  }
  if (opts.appveyor) {
    wrote.push('appveyor.yml')
    fs.writeFileSync('appveyor.yml', appveyor(opts.appveyor))
  }
  if (wrote.length) {
    console.log('Wrote ' + wrote.join(' and '))
  }
}

function download () {
  var file = path.resolve('./package.json')
  var repo = pkg(file)
  var v = require(file).version

  console.log('Downloading prebuilds from ' + repo.user + '/' + repo.repo + '@' + v)

  ghreleases.getByTag({auth: ''}, repo.user, repo.repo, 'v' + v, function (err, doc) {
    if (err) {
      console.log('No release found. Try again after CI has finished')
      process.exit(1)
    }

    var assets = doc.assets

    rimraf.sync('.prebuilds.tmp')
    fs.mkdir('.prebuilds.tmp', function () {
      loop()

      function done () {
        fs.rename('prebuilds', '.prebuilds.old.tmp', function () {
          fs.rename('.prebuilds.tmp', 'prebuilds', function (err) {
            if (err) throw err
            rimraf.sync('.prebuilds.old.tmp')
            console.log('All available prebuilds downloaded and stored in ./prebuilds')
          })
        })
      }

      function loop () {
        var next = assets.pop()
        if (!next) return done()

        console.log('Downloading', next.name)

        var req = request(next.browser_download_url, {
          headers: {'User-Agent': 'prebuildify-ci'}
        })

        if (/\.zip$/.test(next.name)) {
          var buf = []
          req.on('data', data => buf.push(data))
          req.on('end', function () {
            var uz = unzip.Extract({ path: '.prebuilds.tmp' }).on('close', loop)
            uz.write(Buffer.concat(buf))
            uz.end()
          })
        } else {
          req.pipe(tar.extract('.prebuilds.tmp')).on('finish', loop)
        }
      }
    })
  })
}

function travis (token) {
  return trim(`
    sudo: false
    language: node_js
    node_js:
    - node
    addons:
      apt:
        sources:
        - ubuntu-toolchain-r-test
        packages:
        - g++-4.8
        - gcc-4.8-multilib
        - g++-4.8-multilib
        - gcc-multilib
        - g++-multilib
    os:
    - osx
    - linux
    before_deploy:
    - ARCHIVE_NAME="\${TRAVIS_TAG:-latest}-$TRAVIS_OS_NAME-\`uname -m\`.tar"
    - npm run prebuild
    - if [[ "$TRAVIS_OS_NAME" == "linux" ]]; then ARCH=ia32 npm run prebuild; fi
    - tar --create --verbose --file="$ARCHIVE_NAME" --directory "$TRAVIS_BUILD_DIR/prebuilds"
      .
    deploy:
      provider: releases
      draft: false
      prerelease: true
      file: "$ARCHIVE_NAME"
      skip_cleanup: true
      on:
        tags: true
        node: node
      api_key:
        secure: ${token}
  `)
}

function appveyor (token) {
  return trim(`
    build: false

    skip_branch_with_pr: true

    environment:
      matrix:
        - nodejs_version: "Current"

    configuration: Release
    platform:
      - x86
      - x64

    install:
      - SET PATH=C:\\Program Files (x86)\\Microsoft Visual Studio 14.0\\VC\\bin;%PATH%
      - ps: Install-Product node $env:nodejs_version $env:platform
      - npm install

    test_script:
      - node --version
      - npm --version
      - npm test

    after_test:
      - ps: If ($env:nodejs_version -eq "Current") { npm run prebuild }

    artifacts:
      - path: prebuilds
        name: $(APPVEYOR_REPO_TAG_NAME)-win-$(PLATFORM)
        type: zip

    deploy:
      - provider: GitHub
        artifact: /.*\\.zip/
        draft: false
        prerelease: true
        auth_token:
          secure: ${token}
        on:
          appveyor_repo_tag: true
          nodejs_version: "Current"
  `)
}

function trim (src) {
  var indent = 1
  while (src[indent] === ' ') indent++
  indent--
  return src.split('\n').map(line => line.slice(indent)).join('\n').trim() + '\n'
}
