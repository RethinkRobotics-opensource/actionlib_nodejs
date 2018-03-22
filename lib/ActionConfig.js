
const EventEmitter =  require('events').EventEmitter;

let ACTION_CONF = {};
let configured = false;

// make this so conf can alert when its configured
const exportItem = new EventEmitter();

const FIELDS_FORMAT = [
  'log',
  {
    name: 'time',
    format: [
      'isZeroTime',
      'timeComp',
      'now',
      'toNumber',
      'epoch'
    ]
  },
  {
    name: 'messages',
    format: [
      'getMessage',
      'getMessageConstants'
    ]
  },
  'ActionServerInterface',
  'ActionClientInterface'
];

function reset() {
  configured = false;
}

function readConfig(conf, formatFields, writeConf, keyPath = '') {
  if (!formatFields) {
    throw new Error('Unable to readConfig without format at ' + keyPath);
  }
  else if (!conf) {
    throw new Error('Invalid config - missing entry at ' + keyPath);
  }

  for (let i = 0; i < formatFields.length; ++i) {
    const formatField = formatFields[i];

    if (typeof formatField === 'string') {
      const confVal = conf[formatField];
      if (confVal === undefined) {
        const fullPath = keyPath ? keyPath + '.' + formatField : formatField;
        throw new Error('Unable to readConfig without field ' + fullPath);
      }

      writeConf[formatField] = confVal;
    }
    else if (typeof formatField === 'object') {
      const { name, format } = formatField;
      if (!writeConf.hasOwnProperty(name)) {
        writeConf[name] = {};
      }

      const fullPath = keyPath ? keyPath + '.' + name : name;
      readConfig(conf[name], format, writeConf[name], fullPath);
    }
  }
}

function init(conf) {
  readConfig(conf, FIELDS_FORMAT, ACTION_CONF);
  configured = true;
  exportItem.emit('configured', ACTION_CONF);
}

function isConfigured() {
  return configured;
}

function get() {
  return ACTION_CONF;
}

exportItem.init = init;
exportItem.reset = reset;
exportItem.isConfigured = isConfigured;
exportItem.get = get;

module.exports = exportItem;
