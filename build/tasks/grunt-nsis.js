module.exports = function (grunt) {
    grunt.registerMultiTask('nsis', 'Launches NSIS installer', function () {
        const fs = require('fs');
        const { execFileSync } = require('child_process');

        const done = this.async();
        const opt = this.options();
        const args = [];
        const win = process.platform === 'win32';
        const prefix = win ? '/' : '-';
        Object.keys(opt.vars).forEach((key) => {
            let value = opt.vars[key];
            if (typeof value === 'function') {
                value = value();
            }
            if (value) {
                args.push(`${prefix}D${key}=${value}`);
            }
        });
        args.push(`${prefix}Darch=${opt.arch}`);
        args.push(`${prefix}Doutput=${opt.output}`);
        args.push(`${prefix}NOCD`);
        args.push(`${prefix}V2`);
        args.push(opt.installScript);

        const executable = findNsisExecutable({
            win,
            override: grunt.option('nsis-path') || process.env.MAKENSIS
        });
        grunt.log.writeln('Running NSIS:', args.join(' '));
        grunt.util.spawn(
            {
                cmd: executable,
                args,
                opts: { stdio: 'inherit' }
            },
            (error, result, code) => {
                if (error) {
                    if (error.code === 'ENOENT') {
                        return grunt.warn(
                            `NSIS error: makensis not found (${executable}). ` +
                                'Install NSIS or set MAKENSIS env var / pass --nsis-path=C:\\path\\to\\makensis.exe'
                        );
                    }
                    return grunt.warn('NSIS error: ' + error);
                }
                if (code) {
                    return grunt.warn('NSIS exit code ' + code);
                }
                done();
            }
        );

        function findNsisExecutable({ win, override }) {
            if (!win) {
                return override || 'makensis';
            }
            if (override && fs.existsSync(override)) {
                return override;
            }
            const candidates = [
                'C:\\Program Files (x86)\\NSIS\\makensis.exe',
                'C:\\Program Files\\NSIS\\makensis.exe'
            ];
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }
            try {
                const out = execFileSync('where.exe', ['makensis'], {
                    stdio: ['ignore', 'pipe', 'ignore'],
                    encoding: 'utf8'
                });
                const first = out.split(/\r?\n/).find(Boolean);
                if (first && fs.existsSync(first)) {
                    return first;
                }
            } catch (e) {
                // ignore
            }
            return candidates[0];
        }
    });
};
