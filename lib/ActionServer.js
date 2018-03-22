/*
 *    Copyright 2017 Rethink Robotics
 *
 *    Copyright 2017 Chris Smith
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

'use strict';

const ActionConfig = require('./ActionConfig.js');

const EventEmitter = require('events');

const GoalHandle = require('./GoalHandle.js');

/**
 * @class ActionServer
 * EXPERIMENTAL
 *
 */
class ActionServer extends EventEmitter {
  constructor(options) {
    super();

    this._options = options;

    this._pubSeqs = {
      result: 0,
      feedback: 0,
      status: 0
    };

    this._goalHandleList = [];
    this._goalHandleCache = {};

    this._lastCancelStamp = timeUtils.epoch();

    this._statusListTimeout = 5;
  }

  start() {
    this._asInterface = new ActionServerInterface(this._options);

    this._asInterface.on('goal', this._handleGoal.bind(this));
    this._asInterface.on('cancel', this._handleCancel.bind(this));

    const actionType = this._asInterface.getType();

    this._messageTypes = {
      result: ActionConfig.get().messages.getMessage(actionType + 'Result'),
      feedback: ActionConfig.get().messages.getMessage(actionType + 'Feedback'),
      actionResult: ActionConfig.get().messages.getMessage(actionType + 'ActionResult'),
      actionFeedback: ActionConfig.get().messages.getMessage(actionType + 'ActionFeedback')
    };
  }

  generateGoalId() {
    return this._asInterface.generateGoalId();
  }

  shutdown() {
    return this._asInterface.shutdown();
  }

  _getGoalHandle(id) {
    return this._goalHandleCache[id];
  }

  _handleGoal(msg) {
    const newGoalId = msg.goal_id.id;

    let handle = this._getGoalHandle(newGoalId);

    if (handle) {
      // check if we already received a request to cancel this goal
      if (handle.getStatusId() === GoalStatuses.RECALLING) {
        handle.setCancelled(this._createMessage('result'));
      }

      handle._destructionTime = msg.goal_id.stamp;
      return false;
    }

    handle = new GoalHandle(msg.goal_id, this);
    this._goalHandleList.push(handle);
    this._goalHandleCache[handle.id] = handle;

    const goalStamp = msg.goal_id.stamp;
    // check if this goal has already been cancelled based on its timestamp
    if (!timeUtils.isZeroTime(goalStamp) &&
        timeUtils.timeComp(goalStamp, this._lastCancelStamp) < 0) {
      handle.setCancelled(this._createMessage('result'));
      return false;
    }
    else {
      // track goal, I guess
      this.emit('goal', handle);
    }

    return true;
  }

  _handleCancel(msg) {
    const cancelId = msg.id;
    const cancelStamp = msg.stamp;
    const cancelStampIsZero = timeUtils.isZeroTime(cancelStamp);

    const shouldCancelEverything = (cancelId === '' && cancelStampIsZero);

    let goalIdFound = false;

    for (let i = 0, len = this._goalHandleList.length; i < len; ++i) {
      const handle = this._goalHandleList[i];
      const handleId = handle.id;
      const handleStamp = handle.getStatus().goal_id.stamp;

      if (shouldCancelEverything ||
          cancelId === handleId ||
          (!timeUtils.isZeroTime(handleStamp) &&
           timeUtils.timeComp(handleStamp, cancelStamp) < 0))
      {
        if (cancelId === handleId) {
          goalIdFound = true;
        }

        if (handle.setCancelRequested()) {
          this.emit('cancel', handle);
        }
      }
    }

    // if the requested goal_id was not found and it is not empty,
    // then we need to store the cancel request
    if (cancelId !== '' && !goalIdFound) {
      const handle = new GoalHandle(msg, this, GoalStatuses.RECALLING);
      this._goalHandleList.push(handle);
      this._goalHandleCache[handle.id] = handle;
    }

    // update the last cancel stamp if new one occurred later
    if (timeUtils.timeComp(cancelStamp, this._lastCancelStamp) > 0) {
      this._lastCancelStamp = cancelStamp;
    }
  }

  publishResult(status, result) {
    const msg = this._createMessage('actionResult', { status, result });
    msg.header.stamp = timeUtils.now();
    msg.header.seq = this._getAndIncrementSeq('actionResult');
    this._asInterface.publishResult(msg);
    this.publishStatus();
  }

  publishFeedback(status, feedback) {
    const msg = this._createMessage('actionFeedback', { status, feedback });
    msg.header.stamp = timeUtils.now();
    msg.header.seq = this._getAndIncrementSeq('actionFeedback');
    this._asInterface.publishFeedback(msg);
    this.publishStatus();
  }

  publishStatus() {
    const msg = new GoalStatusArrayMsg();
    msg.header.stamp = timeUtils.now();
    msg.header.seq = this._getAndIncrementSeq('status');

    let goalsToRemove = new Set();

    const now = timeUtils.toNumber(timeUtils.now());

    for (let i = 0, len = this._goalHandleList.length; i < len; ++i) {
      const goalHandle = this._goalHandleList[i];
      msg.status_list.push(goalHandle.getGoalStatus());

      const t = goalHandle._destructionTime;
      const tNum = timeUtils.toNumber(t);
      if (!timeUtils.isZeroTime(t) &&
          timeUtils.toNumber(t) + this._statusListTimeout < now)
      {
        goalsToRemove.add(goalHandle);
      }
    }

    // clear out any old goal handles
    this._goalHandleList = this._goalHandleList.filter((goal) => {
      // kind of funky to remove from another object in this filter...
      if (goalsToRemove.has(goal)) {
        delete this._goalHandleCache[goal.id];
        return false;
      }
      return true;
    });

    this._asInterface.publishStatus(msg);
  }

  _getAndIncrementSeq(type) {
    return this._pubSeqs[type]++
  }

  _createMessage(type, args = {}) {
    return new this._messageTypes[type](args);
  }
}

module.exports = ActionServer;


//------------------------------------------------------------------------
//   Hook into configuration
//------------------------------------------------------------------------

let GoalStatusMsg, GoalStatuses, GoalIdMsg, GoalStatusArrayMsg;
let timeUtils, log, ActionServerInterface;

ActionConfig.on('configured', function(config) {
  timeUtils = config.time;
  log = config.log;

  GoalStatusMsg = config.messages.getMessage('actionlib_msgs/GoalStatus');
  GoalStatuses = config.messages.getMessageConstants('actionlib_msgs/GoalStatus');
  GoalIdMsg = config.messages.getMessage('actionlib_msgs/GoalId');
  GoalStatusArrayMsg = config.messages.getMessage('actionlib_msgs/GoalStatusArray');

  ActionServerInterface = config.ActionServerInterface;
});
