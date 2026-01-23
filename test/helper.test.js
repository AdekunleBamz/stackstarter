const assert = require('assert');
const helper = require('../src/helper');

describe('Helper', function() {
  it('should greet correctly', function() {
    assert.equal(helper.greet('World'), 'Hello, World!\');
  });
});
