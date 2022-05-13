import events from "events";
import * as chai from "chai";

// Make sure dates are displayed in the correct timezone
process.env.TZ = "Europe/Stockholm";

// Tests should always run in test environment to prevent accidental deletion of
// real elasticsearch indices etc.
// This file is required with ./test/mocha.opts
process.env.NODE_ENV = "test";

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

global.expect = chai.expect;

// This is needed as we create many clients within the tests
// and they all listen to SIGTERM
events.EventEmitter.defaultMaxListeners = 100;
