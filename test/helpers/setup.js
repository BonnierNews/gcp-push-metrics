"use strict";

// Make sure dates are displayed in the correct timezone
process.env.TZ = "Europe/Stockholm";

// Tests should always run in test environment to prevent accidental deletion of
// real elasticsearch indices etc.
// This file is required with ./test/mocha.opts
process.env.NODE_ENV = "test";

import * as chai from "chai";

chai.config.truncateThreshold = 0;
chai.config.includeStack = true;

global.expect = chai.expect;
