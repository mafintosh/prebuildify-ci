# prebuildify-ci

Easily setup prebuilding of native modules using CI and [prebuildify](https://github.com/prebuild/prebuildify)

```
npm install -g prebuildify-ci
```

## Usage

First create a native module and add a `prebuild` script to your npm scripts
that prebuilds the module using [prebuildify](https://github.com/prebuild/prebuildify).

An example of this can be found in the [turbo-net package](https://github.com/mafintosh/turbo-net/blob/master/package.json#L20)

Then setup a travis and appveyor file using prebuildify-ci

```sh
prebuildify-ci init
```

The above script will prompt for an encrypted travis and appveyor github token.

You can use the `travis` command line tool to encrypt one for travis using the `travis encrypt` command,
and for appveyor you can use the following web interface, https://ci.appveyor.com/tools/encrypt

The Github token needs access to upload to the Github releases of the project.

The ci config will prebuild on every time a new tag is pushed.

```sh
# tag your release
npm version minor
```

Then `git push` it (you might need a `git push --tags` depending on your config) *without* npm publishing it.

Wait for CI to finish. Once all the builds are done run

```sh
prebuildify-ci download
```

This will download all the prebuilds into ./prebuilds where [node-gyp-build](https://github.com/prebuild/node-gyp-build) will
expect them to be stored. To optionally verify the number of expected platform-arch combinations, pass an `--expect <n>` parameter.

That's it! Now you are ready to publish your tarball with the prebuilds included.

```sh
npm publish
```

## License

MIT
