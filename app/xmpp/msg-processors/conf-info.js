'use strict';

var MessageProcessor = require('./../msg-processor');

module.exports = MessageProcessor.extend({

    if: function() {
        return this.toConfRoot &&
               this.ns['http://jabber.org/protocol/disco#info'];
    },

    then: function(cb) {
        var stanza = this.Iq();

        var query = stanza.c('query', {
            xmlns: 'http://jabber.org/protocol/disco#info'
        });

        var groupName = (process.env.FREEPBX_SYSTEM_IDENT) ? process.env.FREEPBX_SYSTEM_IDENT : 'UC Chat';

        query.c('identity', {
            category: 'conference',
            type: 'text',
            name: groupName 
        });

        query.c('feature', {
            var: 'http://jabber.org/protocol/muc'
        });

        cb(null, stanza);
    }

});
