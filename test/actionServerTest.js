'use strict'

const net = require('net');
const chai = require('chai');
const expect = chai.expect;

const rosnodejs = require('rosnodejs');

const ActionLib = require('../index.js');

ActionLib.config({
  time: rosnodejs.Time,
  log: rosnodejs.log.getLogger('actionlibjs'),
  messages: {
    getMessage(fullName) {
      const [pkg, name] = fullName.split('/');
      return rosnodejs.require(pkg).msg[name]
    },
    getMessageConstants(fullName) {
      return this.getMessage(fullName).CONSTANTS;
    }
  },
  ActionServerInterface,
  ActionClientInterface
});

describe('action server', function() {

});
