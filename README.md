# Solfuzz
[![Discord](https://img.shields.io/discord/481002907366588416.svg)](https://discord.gg/E3YrVtG)

Solfuzz is an assertion checker for smart contracts written in Solidity. It uses [MythX](https://mythx.io) EVM-level fuzzing and symbolic execution to uncover bugs in the code.

<p align="center">
	<img src="/static/screenshot.png" width="100%"/>
</p>

## Installation

```
$ npm install -g solfuzz
```

Get a [free API key](https://dashboard.mythx.io) and set the `MYTHX_API_KEY` enviroment variable by adding the following to your `.bashrc` or `.bash_profile`):

```
export MYTHX_API_KEY=eyJhbGciOiJI(...)
```

## Usage

Run `solfuzz check <solidity-file> [contract-name]` to start a job. The default analysis type runs for approximately two minutes. Solfuzz supports two types of assertions:


```
// Solidity assertion

assert(false);

// MythX assertion

if (false) {
    emit AssertionFailed("Custom error message");
}
```

### Example 1: Primality test

You're pretty sure that 973013 is a prime number. It ends with a "3" so why wouldn't it be??


```
pragma solidity ^0.5.0;

contract Primality {
    
    uint256 public largePrime = 973013;
    
    uint256 x;
    uint256 y;
    
    function setX(uint256 _x) external {
        x = _x;
    }
 
    function setY(uint256 _y) external {
        y = _y;
    }
    
    function verifyPrime() external view {
        require(x > 1 && x < largePrime);
        require(y > 1 && y < largePrime);
        assert(x*y != largePrime);
    }
}
```

Obviously the assertion in `verifyPrime()` will hold for all possible inputs?


```
$ solfuzz check primality.sol
--------------------
ASSERTION VIOLATION!
/Users/bernhardmueller/Desktop/primality.sol: from 21:8 to 21:33

assert(x*y != largePrime)
--------------------
Call sequence:

    1: setY(1021)
    Sender: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa [ USER ]
    Value: 0

    2: setX(953)
    Sender: 0xaffeaffeaffeaffeaffeaffeaffeaffeaffeaffe [ CREATOR ]
    Value: 0

    3: verifyPrimeness()
    Sender: 0xaffeaffeaffeaffeaffeaffeaffeaffeaffeaffe [ CREATOR ]
    Value: 0

```

Oh no! 1021 x 953 = 973013, better pick a different number 🙄

### Example 2: Integer precision bug

Source: [Sigma Prime](https://blog.sigmaprime.io/solidity-security.html#precision-vuln)

Here is a simple contract for buying and selling tokens. What could possibly go wrong?

```
pragma solidity ^0.5.0;

contract FunWithNumbers {
    uint constant public tokensPerEth = 10;
    uint constant public weiPerEth = 1e18;
    mapping(address => uint) public balances;

    function buyTokens() public payable {
        uint tokens = msg.value/weiPerEth*tokensPerEth; // convert wei to eth, then multiply by token rate
        balances[msg.sender] += tokens;
    }

    function sellTokens(uint tokens) public {
        require(balances[msg.sender] >= tokens);
        uint eth = tokens/tokensPerEth;
        balances[msg.sender] -= tokens;
        msg.sender.transfer(eth*weiPerEth); 
    }
}
```

Better safe than sorry! Let's check some [contract invariants](https://gist.github.com/b-mueller/0916c3700c94e94b23dfa9aa650005e8) just to be 1,700% sure that everything works as expected.

```
$ solfuzz check funwithnumbers.sol 
--------------------
ASSERTION VIOLATION!
/Users/bernhardmueller/Desktop/funwithnumbers.sol: from 47:17 to 47:131

AssertionFailed("Invariant violation: Sender token balance must increase when contract account balance increases")
--------------------
Call sequence:

    1: buyTokens()
    Sender: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa3 [ USER ]
    Value: 6

--------------------
ASSERTION VIOLATION!
/Users/bernhardmueller/Desktop/funwithnumbers.sol: from 56:17 to 56:131

AssertionFailed("Invariant violation: Contract account balance must decrease when sender token balance decreases")
--------------------
Call sequence:

    1: buyTokens()
    Sender: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0 [ USER ]
    Value: 1000000000000000000

    2: sellTokens(6)
    Sender: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0 [ USER ]
    Value: 0
```

Um what?? Fractional numbers are rounded down 😲

### Example 3: Arbitrary storage write

Source: [Ethernaut](https://ethernaut.openzeppelin.com/level/0xe83cf387ddfd13a2db5493d014ba5b328589fb5f)

This [smart contract]((https://ethernaut.openzeppelin.com/level/0xe83cf387ddfd13a2db5493d014ba5b328589fb5f) has, and will always have, only one owner. There isn't even a `transferOwnership` function. But... can you be really sure? Don't you at least want to double-check with a high-level, catch-all invariant?

```
contract VerifyRegistrar is Registrar {
    
    modifier checkInvariants {
        address old_owner = owner;
        _;
        assert(owner == old_owner);
    }
    
    function register(bytes32 _name, address _mappedAddress) checkInvariants public {
        super.register(_name, _mappedAddress);
    }
}
```

Let's check just to be 15,000% sure.


```
$ solfuzz check registrar.sol 
[    ] Loading solc v0.4.25(node:55958) V8: :3 Invalid asm.js: Invalid member of stdlib
✔ Loaded solc v0.4.25 from local cache
✔ Compiled with solc v0.4.25 successfully
✔ Analysis job submitted: https://dashboard.mythx.io/#/console/analyses/e98a345e-7418-4209-ab99-bffdc2535d9b
--------------------
ASSERTION VIOLATION!
/Users/bernhardmueller/Desktop/registrar.sol: from 40:8 to 40:34

assert(owner == old_owner)
--------------------
Call sequence:

    1: register(b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 0x0000000000000000000000000000000000000000)
    Sender: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa [ USER ]
    Value: 0
```

Ooops... better initialize those structs before using them.

### Example 4: Pausable token

Source: [TrailofBits](https://github.com/crytic/building-secure-contracts/tree/master/program-analysis/echidna/exercises/exercise1)
 
Smart contracts get hacked all the time so it's always great to have a pause button, even if it's just a [simple token
](https://github.com/crytic/building-secure-contracts/tree/master/program-analysis/echidna/exercises/exercise1). This is even an off-switch if we pause the token and throw away the admin account? Or is it?

Why not create an instance of the contract that's infinitely paused and check if there's any way to unpause it.

```
contract VerifyToken is Token {

    event AssertionFailed(string message);

    constructor() public {
        paused();
        owner = address(0x0); // lose ownership
    }
     
     function transfer(address to, uint value) public {
        uint256 old_balance = balances[msg.sender];

        super.transfer(to, value);

        if (balances[msg.sender] != old_balance) {
            emit AssertionFailed("Tokens transferred even though this contract instance was infinitely paused!!");
        }
     }
}
```

Given that this contract is forever paused, it should never be possible to transfer any tokens right?


```
$ solfuzz check token.sol 
✔ Loaded solc v0.5.16 from local cache
✔ Compiled with solc v0.5.16 successfully
✔ Analysis job submitted: https://dashboard.mythx.io/#/console/analyses/8d4b0eb0-69d3-4d82-b6c6-bc90332a292c
--------------------
ASSERTION VIOLATION!
/Users/bernhardmueller/Desktop/token.sol: from 64:17 to 64:113

AssertionFailed("Tokens transferred even though this contract instance was infinitely paused!!")
--------------------
Call sequence:

    1: Owner()
    Sender: 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef [ ATTACKER ]
    Value: 0

    2: resume()
    Sender: 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef [ ATTACKER ]
    Value: 0

    3: transfer(0x0008000002400240000200104000104080001000, 614153205830163099331592192)
    Sender: 0xaffeaffeaffeaffeaffeaffeaffeaffeaffeaffe [ CREATOR ]
    Value: 0
```

Oh no 😵 Looks like somebody slipped up there when naming the constructor.


### Example 5: MakerDAO bug

Source: [OpenZeppelin](https://forum.openzeppelin.com/t/using-automatic-analysis-tools-with-makerdao-contracts/1021)

This voting logic is so simple that it doesn't even warrant a check, but better to cover all bases.

TODO

#### Additional commands and options

### Analysis depth

```
--mode <quick/standard/deep>
```

MythX distributes incoming analysis to a number of workers that perform various tasks in parallel. There are two analysis modes, "quick", "standard" and "deep", that differ in the amount of resources dedicated to the analysis. Expect the following durations:

- Quick: >=120 seconds
- Standard: 20 minutes
- Deep: 45 minutes

The tools cover as much ground as possible in the available time. A coverage metric will be added soon.

### Report format

```
--format <text/eslint>
```

Select the report format. Note that you can also view reports for past analyses on the [dashboard](http://dashboard.mythx.io).

### Other commands

Besides `analyze` the following commands are available.

```
- list              Get a list of submitted analyses.
- status <UUID>     Get the status of an already submitted analysis
- version           Print version
```

### Debugging

```
--debug
```

Dump the API request and reponse when submitting an analysis.

# How it works

Some articles and papers explaining the tech behind this tool:

- [Learning Inputs in Greybox Fuzzing](https://arxiv.org/pdf/1807.07875.pdf)
- [Smashing Smart Contracts (HITB GSEC 2018)](https://conference.hitb.org/hitbsecconf2018ams/materials/D1T2%20-%20Bernhard%20Mueller%20-%20Smashing%20Ethereum%20Smart%20Contracts%20for%20Fun%20and%20ACTUAL%20Profit.pdf)
- [Advances in Smart Contract Vulnerability Detection (DEFCON 27)](https://github.com/b-mueller/smashing-smart-contracts/blob/master/DEFCON27-EVM-Smart-Contracts-Mueller-Luca.pdf)
- [The Tech Behind MythX](https://medium.com/consensys-diligence/the-tech-behind-mythx-smart-contract-security-analysis-32c849aedaef)
- [Harvey Greybox Fuzzing Article Series](https://medium.com/consensys-diligence/finding-vulnerabilities-in-smart-contracts-175c56affe2)
- [Fuzzing Smart Contracts Using Input Prediction](https://medium.com/consensys-diligence/fuzzing-smart-contracts-using-input-prediction-29b30ba8055c)
- [Fuzzing Smart Contracts Using Multiple Transactions](https://medium.com/consensys-diligence/fuzzing-smart-contracts-using-multiple-transactions-51471e4b3c69)
- [Intro to Symbolic Execution in Mythril](https://medium.com/@joran.honig/introduction-to-mythril-classic-and-symbolic-execution-ef59339f259b)
- [Practical Mutation Testing in Smart Contracts](https://www.researchgate.net/publication/335937116_Practical_Mutation_Testing_for_Smart_Contracts)
