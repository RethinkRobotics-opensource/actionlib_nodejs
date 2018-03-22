const rosnodejs = require('rosnodejs');
const ActionServerInterface = require('rosnodejs/dist/lib/ActionServerInterface');
const ActionClientInterface = require('rosnodejs/dist/lib/ActionClientInterface');

const ActionLib = require('./index.js');

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

rosnodejs.initNode('/tmp')
.then(() => {
  const as = new ActionLib.ActionServer({
    type: 'intera_motion_msgs/MotionCommand',
    actionServer: '/motion',
    nh: rosnodejs.nh
  });


})
.catch((err) => {
  console.error(err.stack);
})
