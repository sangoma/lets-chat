'use strict';

var MessageProcessor = require('./../msg-processor'),
    settings = require('./../../config');

module.exports = MessageProcessor.extend({

    if: function() {
        return this.ns['http://jabber.org/protocol/disco#items'] && (
            this.to === this.connection.getDomain() ||
            this.to === settings.xmpp.domain
        );
    },

    then: function(cb) {
        var stanza = this.Iq();

        var query = stanza.c('query', {
            xmlns: 'http://jabber.org/protocol/disco#items'
        });

        var groupName = (process.env.FREEPBX_SYSTEM_IDENT) ? process.env.FREEPBX_SYSTEM_IDENT : 'UC Chat';

        query.c('item', {
            jid: this.connection.getConfDomain(),
            name: groupName
        });

        cb(null, stanza);
    }

});
