const { generateMnemonic } = require('tonweb-mnemonic');

generateMnemonic().then(mnemonic => {
  console.log('🪪 Your new 24-word TON mnemonic:\n');
  console.log(mnemonic.join(' '));
});
