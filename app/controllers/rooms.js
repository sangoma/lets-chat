//
// Rooms Controller
//

'use strict';

var _ = require('lodash'),
    exec = require('child_process').exec,
    settings = require('./../config').rooms,
    child;

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares,
        models = this.models,
        User = models.user;

    core.on('presence:user_join', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.room = data.roomId;
                if (data.roomHasPassword) {
                    app.io.to(data.roomId).emit('users:join', user);
                } else {
                    app.io.emit('users:join', user);
                }
            }
        });
    });

    core.on('presence:user_leave', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.room = data.roomId;
                if (data.roomHasPassword) {
                    app.io.to(data.roomId).emit('users:leave', user);
                } else {
                    app.io.emit('users:leave', user);
                }
            }
        });
    });

    core.on('rooms:invite', function(message, room, user) {
        var msg = message.toJSON();
        User.findById(message.owner, function (err, owner) {
          if (err) {
            console.log(err);
          }
          msg.owner = owner.username;
          msg.room = room.toJSON(user);

          var connections = core.presence.system.connections.query({
              type: 'socket.io', userId: user._id.toString()
          });

          if (room.participants.indexOf(user._id) === -1) {
            if (connections.length > 0) {
              connections.forEach(function(connection, index) {
                  connection.socket.emit('rooms:invite', msg);
              });
            }
            else {
              var mailerParams = {};
              mailerParams['sender'] = owner.username;
              mailerParams['receiver'] = user.username;
              mailerParams['room'] = {'type': 'room', 'name': room.name};
              mailerParams['message'] = message.text;
              var encodedParams = new Buffer(JSON.stringify(mailerParams)).toString("base64");
              var command = "/var/lib/asterisk/bin/chatmailer.php "+ encodedParams;
              console.log('Executing command: '+ command)
              child = exec(command,
                 function (error, stdout, stderr) {
                    if (error !== null) {
                         console.log('exec error: ', error);
                    }
                 });
            }
          }
          else {
            var mailerParams = {};
            mailerParams['sender'] = owner.username;
            mailerParams['receiver'] = user.username;
            mailerParams['room'] = {'type': 'room', 'name': room.name};
            mailerParams['message'] = message.text;
            var encodedParams = new Buffer(JSON.stringify(mailerParams)).toString("base64");
            var command = "/var/lib/asterisk/bin/chatmailer.php "+ encodedParams;
            console.log('Executing command: '+ command)
            child = exec(command,
               function (error, stdout, stderr) {
                  if (error !== null) {
                    console.log('exec error: ' + error);
                  }
               });
          }
        });
    });

    var getEmitters = function(room) {
        if (room.private && !room.hasPassword) {
            var connections = core.presence.connections.query({
                type: 'socket.io'
            }).filter(function(connection) {
                return room.isAuthorized(connection.user);
            });

            return connections.map(function(connection) {
                return {
                    emitter: connection.socket,
                    user: connection.user
                };
            });
        }

        return [{
            emitter: app.io
        }];
    };

    core.on('rooms:new', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:new', room.toJSON(e.user));
        });
    });

    core.on('rooms:update', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:update', room.toJSON(e.user));
        });
    });

    core.on('rooms:archive', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:archive', room.toJSON(e.user));
        });
    });


    //
    // Routes
    //
    app.route('/rooms')
        .all(middlewares.requireLogin)
        .get(function(req) {
            req.io.route('rooms:list');
        })
        .post(function(req) {
            req.io.route('rooms:create');
        });

    app.route('/rooms/:room')
        .all(middlewares.requireLogin, middlewares.roomRoute)
        .get(function(req) {
            req.io.route('rooms:get');
        })
        .put(function(req) {
            req.io.route('rooms:update');
        })
        .delete(function(req) {
            req.io.route('rooms:archive');
        });

    app.route('/rooms/:room/users')
        .all(middlewares.requireLogin, middlewares.roomRoute)
        .get(function(req) {
            req.io.route('rooms:users');
        });

    app.route('/rooms/:room/invite')
         .all(middlewares.requireLogin, middlewares.roomRoute)
         .post(function(req, res) {
             req.io.route('rooms:invite');
         });


    //
    // Sockets
    //
    app.io.route('rooms', {
        list: function(req, res) {
            var options = {
                    userId: req.user._id,
                    users: req.param('users'),

                    skip: req.param('skip'),
                    take: req.param('take')
                };

            core.rooms.list(options, function(err, rooms) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                var results = rooms.map(function(room) {
                    return room.toJSON(req.user);
                });

                res.json(results);
            });
        },
        get: function(req, res) {
            var options = {
                userId: req.user._id,
                identifier: req.param('room') || req.param('id')
            };

            core.rooms.get(options, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                res.json(room.toJSON(req.user));
            });
        },
        create: function(req, res) {
            var options = {
                owner: req.user._id,
                name: req.param('name'),
                slug: req.param('slug'),
                description: req.param('description'),
                private: req.param('private'),
                password: req.param('password')
            };

            if (!settings.private) {
                options.private = false;
                delete options.password;
            }

            core.rooms.create(options, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                res.status(201).json(room.toJSON(req.user));
            });
        },
        update: function(req, res) {
            var roomId = req.param('room') || req.param('id');

            var options = {
                    name: req.param('name'),
                    slug: req.param('slug'),
                    description: req.param('description'),
                    password: req.param('password'),
                    participants: req.param('participants'),
                    user: req.user
                };

            if (!settings.private) {
                delete options.password;
                delete options.participants;
            }

            core.rooms.update(roomId, options, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                res.json(room.toJSON(req.user));
            });
        },
        archive: function(req, res) {
            var roomId = req.param('room') || req.param('id');

            core.rooms.archive(roomId, function(err, room) {
                if (err) {
                    console.log(err);
                    return res.sendStatus(400);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                res.sendStatus(204);
            });
        },
        join: function(req, res) {
            var options = {
                    userId: req.user._id,
                    saveMembership: true
                };

            if (typeof req.data === 'string') {
                options.id = req.data;
            } else {
                options.id = req.param('roomId');
                options.password = req.param('password');
            }

            core.rooms.canJoin(options, function(err, room, canJoin) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(400);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                if(!canJoin && room.password) {
                    return res.status(403).json({
                        status: 'error',
                        roomName: room.name,
                        message: 'password required',
                        errors: 'password required'
                    });
                }

                if(!canJoin) {
                    return res.sendStatus(404);
                }

                var user = req.user.toJSON();
                user.room = room._id;

                core.presence.join(req.socket.conn, room);
                req.socket.join(room._id);
                res.json(room.toJSON(req.user));
            });
        },
        leave: function(req, res) {
            var roomId = req.data;
            var user = req.user.toJSON();
            user.room = roomId;

            core.presence.leave(req.socket.conn, roomId);
            req.socket.leave(roomId);
            res.json();
        },
        users: function(req, res) {
            var roomId = req.param('room');

            core.rooms.get(roomId, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(400);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                var users = core.presence.rooms
                        .getOrAdd(room)
                        .getUsers()
                        .map(function(user) {
                            // TODO: Do we need to do this?
                            user.room = room.id;
                            return user;
                        });

                res.json(users);
            });
        },
        invite: function(req, res) {
           console.log('Invite sent', req.data);
           app.io.emit('rooms:invite', req.data);
        }
    });
};
