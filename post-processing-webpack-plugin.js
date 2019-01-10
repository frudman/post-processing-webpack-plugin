'use strict'

// READ THIS: https://webpack.js.org/concepts/

const log = console.log.bind(console); // for convenience

const { ConcatSource: concatSrc } = require("webpack-sources"); // see: https://github.com/webpack/webpack-sources

//export default 
class WebpackPostProcessingPlugin {

    // from: https://webpack.js.org/contribute/writing-a-plugin/
    // also: https://webpack.js.org/contribute/plugin-patterns/

    constructor(...postProcessors) {
        this.PLUGIN = 'A Webpack Post Production Plugin'; // fyi: can also be an object: {name: 'your plugin name', context: true/false};
        this.postProcessors = postProcessors;
    }

    apply(compiler) {
        // for lambdas below
        const self = this; 

        // some helpers
        const tapX = (X, name, cb) => X.hooks[name].tap(self.PLUGIN, cb);
        const tapAsyncX = (X, name, cb) => X.hooks[name].tapAsync(self.PLUGIN, cb);
        const compilerTap = (name, cb) => tapX(compiler, name, cb);
        const compilerTapAsync = (name, cb) => tapAsyncX(compiler, name, cb);
        const chunkInfo = (info, chunk) => log(`${info} CHUNK: id=${chunk.id}; name=${chunk.name}; ${chunk.files.length} file(s):`, chunk.files);

        // compilerTap('done', stats => log('DONZO --- Bye World!')); // sanity: should happen last...

        compilerTap('compilation', compilation => {

            // read: https://webpack.js.org/api/compilation-hooks/#optimizechunkassets

            tapAsyncX(compilation, 'optimizeChunkAssets', (chunks, callback) => {
                chunks.forEach(chunk => {
                    chunk.files.forEach(filename => {
                        const origSrc = compilation.assets[filename].source(); // save original
                        const cumulative = { [filename]: origSrc }; // cumulative **by file names** so can be multiple streams of post-processing
                        this.postProcessors.forEach(postProcess => {
                            log('processing asset', postProcess);
                            const nextResult = postProcess(origSrc, cumulative, filename);
                            if (typeof nextResult === 'string') {
                                compilation.assets[filename] = new concatSrc(cumulative[filename] = nextResult);
                            }
                            else if (typeof nextResult === 'object') {
                                const file = nextResult.filename || filename;
                                compilation.assets[file] = new concatSrc(cumulative[file] = nextResult.content);
                            }
                            else
                                log('whoops: expecting result as a "string" (i.e. modified content)' 
                                    + ' or as an object (i.e. {[filename:newAssetFileName,] content: modifiedContent})'
                                    + ' - got neither: ', nextResult);
                        });
                    });
                });

                callback();
            })
        })

        // compilerTapAsync('emit', (compilation, callback) => {
        //     compilation.chunks.forEach(chunk => {
        //         chunkInfo('EMITTING', chunk);
        //         chunk.files.forEach(filename => {
        //             const genCode = compilation.assets[filename].source().substr(0, 150) + '...';
        //             log('---GENERATED FILE ' + filename + ':', genCode);
        //         });
        //     });

        //     callback();
        // });
    }
}

// default export
module.exports = WebpackPostProcessingPlugin;
