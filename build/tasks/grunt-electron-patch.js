module.exports = function (grunt) {
    grunt.registerMultiTask('electron-patch', 'Patches Electron executable', async function () {
        const patch = require('electron-evil-feature-patcher');
        const { patchElectronBinaryCompat } = require('../util/electron-evil-feature-patcher-compat');
        const verbose = !!grunt.option('verbose');

        for (const { src } of this.files) {
            for (const path of src) {
                grunt.log.writeln(`Patching ${path}...`);
                try {
                    patch({ path, verbose });
                } catch (e) {
                    if (String(e && e.message).startsWith('Not found: Command-line option: --inspect')) {
                        grunt.log.writeln(
                            'electron-evil-feature-patcher did not match this Electron binary, applying compatibility patch...'
                        );
                        patchElectronBinaryCompat({ path, verbose });
                    } else {
                        throw e;
                    }
                }
            }
        }
    });
};
