'use strict'

// For Webpack 4+ only

// READ: https://webpack.js.org/concepts/
// also: https://webpack.js.org/contribute/writing-a-plugin/
// also: https://webpack.js.org/contribute/plugin-patterns/

// fyi: can also be an object: { name: 'your plugin name', context: true/false };
const PLUGIN = 'A Webpack Post Production Plugin'; // string is ok, we don't need context

// shorthand
const log = console.log.bind(console); 

// helpers (for apply() below)
const tapX = (X, name, cb) => X.hooks[name].tap(PLUGIN, cb);
const tapAsyncX = (X, name, cb) => X.hooks[name].tapAsync(PLUGIN, cb);

// read: https://github.com/webpack/webpack-sources
const { ConcatSource: concatSrc } = require("webpack-sources"); 

//export default 
class WebpackPostProcessingPlugin {

    constructor(...postProcessors) {

        this.postProcessors = postProcessors.map(pp => 
            (typeof pp === 'function') ? {
                test() { return true; },
                process: pp,
            }
            : (typeof pp === 'object') ? Object.assign({
                test() { return true; },
                process(src) { return src; }
            }, pp)
            : { test() { 
                log('POST-PROCESSOR must be a function or an object (i.e. { test(filename){}, process(original,current,filename){} })\n...so ignoring:', pp)
                return false; // ignore always
            } }
        );

        this.applicable = filepath => this.postProcessors.find(pp => pp.test(filepath));
    }

    apply(compiler) {
        // trivial
        if (this.postProcessors.length === 0) return;

        // for lambdas below
        const self = this; 

        // helpers
        const compilerTap = (name, cb) => tapX(compiler, name, cb);
        const compilerTapAsync = (name, cb) => tapAsyncX(compiler, name, cb);
        const chunkInfo = (info, chunk) => log(`${info} CHUNK: id=${chunk.id}; name=${chunk.name}; ${chunk.files.length} file(s):`, chunk.files);

        // compilerTap('done', stats => log('DONZO --- Bye World!')); // sanity: should happen last...

        compilerTap('compilation', compilation => {

            // read: https://webpack.js.org/api/compilation-hooks/#optimizechunkassets

            tapAsyncX(compilation, 'optimizeChunkAssets', (chunks, callback) => {
                chunks.forEach(chunk => {
                    chunk.files.forEach(filepath => { // full filename relative to dist folder

                        // if none of the processors are applicable for this file...
                        if (!this.applicable(filepath)) return; // ...short-circuit

                        const origSrc = compilation.assets[filepath].source(); // save original
                        const cumulative = { [filepath]: origSrc }; // cumulative **by file names** so can be multiple streams of post-processing
                        this.postProcessors.forEach(pp => {

                            if (!pp.test(filepath)) return; // processor not applicable for this file

                            const nextPass = pp.process(origSrc, cumulative, filepath);
                            if (typeof nextPass === 'string') {
                                compilation.assets[filepath] = new concatSrc(cumulative[filepath] = nextPass);
                            }
                            else if (typeof nextPass === 'object') {
                                const file = nextPass.filepath || filepath;
                                compilation.assets[file] = new concatSrc(cumulative[file] = nextPass.content);
                            }
                            else
                                log('whoops: expecting result as a "string" (i.e. modified content)' 
                                    + ' or as an object (i.e. {[filepath:newAssetFilepath,] content: modifiedContent})'
                                    + ' - got neither: ', nextPass);
                        });
                    });
                });

                callback();
            })
        })

        // compilerTapAsync('emit', (compilation, callback) => {
        //     compilation.chunks.forEach(chunk => {
        //         chunkInfo('EMITTING', chunk);
        //         chunk.files.forEach(filepath => {
        //             const genCode = compilation.assets[filepath].source().substr(0, 150) + '...';
        //             log('---GENERATED FILE ' + filepath + ':', genCode);
        //         });
        //     });

        //     callback();
        // });
    }
}

// default export
module.exports = WebpackPostProcessingPlugin;
