module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            ClientObject: {
                src: ['./src/client/main.js'],
                dest: './out/client/main.js',
                options: {
                    browserifyOptions: {
                        standalone: 'SFUClient'
                    }
                }
            },
            ControllerObject: {
                src: ['./src/controller/main.js'],
                dest: './out/controller/main.js',
                options: {
                    browserifyOptions: {
                        standalone: 'SFUController'
                    }
                }
            }
        },
        copy: {
            client: {
                files: [
                    {
                        expand: true,
                        cwd: './src/client',
                        src: [
                            'main.css',
                            'main.html',
                            'config.json'
                        ],
                        dest: 'out/client'
                    },
                    {
                        expand: true,
                        cwd: './',
                        src: [
                            'dependencies/**'
                        ],
                        dest: 'out/client/'
                    },
                    {
                        expand: true,
                        cwd: './src/client',
                        src: [
                            'resources/**'
                        ],
                        dest: 'out/client/'
                    }
                ]
            },
            controller: {
                files: [
                    {
                        expand: true,
                        cwd: './src/controller',
                        src: [
                            'main.css',
                            'main.html',
                            'vconfig.js'
                        ],
                        dest: 'out/controller'
                    },
                    {
                        expand: true,
                        cwd: './',
                        src: [
                            'dependencies/**'
                        ],
                        dest: 'out/controller/'
                    },
                    {
                        expand: true,
                        cwd: './src/controller',
                        src: [
                            'resources/**'
                        ],
                        dest: 'out/controller/'
                    }
                ]
            }
        },
        clean: {
            build: [
                'out/'
            ],
            release: [
                'release'
            ]
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.registerTask('build', [
        'clean:build',
        'copy',
        'browserify'
    ]);
};