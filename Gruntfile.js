module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            PSFUOBject: {
                src: ['./src/sdk/sfu.js'],
                dest: './out/sfu.js',
                options: {
                    browserifyOptions: {
                        standalone: 'SFU'
                    }
                }
            },
            ZSFUOBject: {
                src: ['./src/sdk/sfu-extended.js'],
                dest: './out/sfu-extended.js',
                options: {
                    browserifyOptions: {
                        standalone: 'SFUExtended'
                    }
                }
            }
        },
        copy: {
            examples: {
                files: [
                    {
                        expand: true,
                        cwd: './src',
                        src: [
                            'examples/**'
                        ],
                        dest: 'out'
                    }
                ]
            }
        },
        jsdoc: {
            src: ['./src/sdk/sfu.js', './src/sdk/sfu-extended.js', './src/sdk/room.js', './src/sdk/constants.js'],
            options: {
                template: './docTemplate',
                readme: './docTemplate/README.md',
                destination: 'out/doc/'
            }
        },
        clean: {
            build: [
                'out/'
            ],
            release: [
                'release'
            ]
        },
        run: {
            options: {
                // ...
            },
            test: {
                cmd: 'npm',
                args: [
                    'run',
                    'test'
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-run');
    grunt.registerTask('build', [
        'clean:build',
        'copy',
        'browserify',
        'jsdoc'
    ]);
};