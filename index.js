const ActionServer = require('./lib/ActionServer.js');
const ActionConfig = require('./lib/ActionConfig')

const ActionLib = {
  config(configuration) {
    ActionConfig.init(configuration);
  }
};

function addGuardedGetter(propertyName, val) {
  Object.defineProperty(ActionLib, propertyName, {
    get: function() {
      if (ActionConfig.isConfigured()) {
        return val;
      }
      else {
        throw new Error(`Unable to get propertyName before actionlib has been configured`);
      }
    }
  });
}

addGuardedGetter('ActionServer', ActionServer);

module.exports = ActionLib;
