const { spawn } = require('child_process');

module.exports = function (grunt) {
    grunt.registerMultiTask(
        'osx-adhoc-sign',
        'Ad-hoc signs a macOS app bundle using codesign (for unsigned builds)',
        async function () {
            const done = this.async();

            if (process.platform !== 'darwin') {
                grunt.warn('osx-adhoc-sign can only run on macOS');
                done();
                return;
            }

            const opt = this.options({
                deep: true
            });

            const apps = (this.files && this.files[0] && this.files[0].src) || [];
            if (!apps.length) {
                done();
                return;
            }

            const signOne = (app) =>
                new Promise((resolve) => {
                    const args = ['--force', '--sign', '-', '--timestamp=none'];
                    if (opt.deep) {
                        args.push('--deep');
                    }
                    args.push(app);

                    const cp = spawn('codesign', args, { stdio: 'inherit' });
                    cp.on('error', (err) => {
                        grunt.warn(`Failed to run codesign for ${app}: ${err.message || err}`);
                        resolve();
                    });
                    cp.on('exit', (code) => {
                        if (code) {
                            grunt.warn(`codesign failed for ${app} with exit code ${code}`);
                        } else {
                            grunt.log.writeln('ad-hoc signed:', app);
                        }
                        resolve();
                    });
                });

            Promise.all(apps.map(signOne)).then(done);
        }
    );
};
