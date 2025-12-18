module.exports = function (grunt) {
    const sign = !grunt.option('skip-sign');

    grunt.registerTask('build-web-app', [
        'clean',
        'eslint',
        'copy:html',
        'copy:icons',
        'copy:manifest',
        'webpack:app',
        'inline',
        'htmlmin',
        'csp-hashes',
        'copy:content-dist',
        'string-replace:service-worker',
        'string-replace:update-manifest',
        'copy:dist-icons',
        'copy:dist-manifest'
    ]);

    grunt.registerTask('build-desktop-app-content', [
        'copy:desktop-html',
        'copy:desktop-app-content',
        'string-replace:desktop-public-key'
    ]);

    grunt.registerTask('build-desktop-executables-linux', [
        'electron:linux',
        'electron-patch:linux',
        'chmod:linux-desktop-x64',
        'copy:native-modules-linux-x64',
        'copy:native-messaging-host-linux-x64'
    ]);

    // Modified: Only build darwin-arm64
    grunt.registerTask('build-desktop-executables-darwin', [
        'electron:darwin-arm64',
        'electron-patch:darwin-arm64',
        'build-darwin-installer',
        'copy:desktop-darwin-installer-helper-arm64',
        'copy:native-modules-darwin-arm64',
        'copy:native-messaging-host-darwin-arm64',
        sign ? 'osx-sign:desktop-arm64' : 'noop',
        sign ? 'notarize:desktop-arm64' : 'noop'
    ]);

    grunt.registerTask('build-darwin-installer', [
        'osacompile:installer',
        'copy:darwin-installer-icon',
        sign ? 'osx-sign:installer' : 'noop'
    ]);

    // Modified: Only build win32-x64
    grunt.registerTask('build-desktop-executables-win32', [
        'electron:win32-x64',
        'electron-patch:win32-x64',
        'copy:native-modules-win32-x64',
        'copy:native-messaging-host-win32-x64',
        sign ? 'sign-exe:win32-build-x64' : 'noop'
    ]);

    grunt.registerTask('build-desktop-executables', [
        'build-desktop-executables-linux',
        'build-desktop-executables-darwin',
        'build-desktop-executables-win32'
    ]);

    grunt.registerTask('build-desktop-archives-linux', ['compress:linux-x64']);

    // Modified: Only compress win32-x64
    grunt.registerTask('build-desktop-archives-win32', [
        'compress:win32-x64'
    ]);

    grunt.registerTask('build-desktop-archives', [
        'build-desktop-archives-linux',
        'build-desktop-archives-win32'
    ]);

    // Modified: Only build arm64 dmg
    grunt.registerTask('build-desktop-dist-darwin', ['appdmg:arm64']);

    // Modified: Only build win32-x64 installer
    grunt.registerTask('build-desktop-dist-win32', [
        'nsis:win32-un-x64',
        sign ? 'sign-exe:win32-uninst-x64' : 'noop',
        'nsis:win32-x64',
        sign ? 'sign-exe:win32-installer-x64' : 'noop',
        'copy:desktop-win32-dist-x64'
    ]);

    grunt.registerTask('build-desktop-dist-linux', [
        'deb:linux-x64',
        'electron-builder:linux',
        'copy:electron-builder-dist-linux-rpm',
        'copy:electron-builder-dist-linux-snap',
        'copy:electron-builder-dist-linux-appimage'
    ]);

    grunt.registerTask('build-desktop-dist', [
        'build-desktop-dist-darwin',
        'build-desktop-dist-win32',
        'build-desktop-dist-linux'
    ]);

    grunt.registerTask('build-desktop', [
        'clean:desktop',
        'build-desktop-app-content',
        'build-desktop-executables',
        'build-desktop-archives',
        'build-desktop-dist',
        'sign-dist'
    ]);

    grunt.registerTask('build-test', ['webpack:test']);
};
