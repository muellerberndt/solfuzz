const helpText = `Minimum viable CLI for the MythX security analysis platform.

USAGE:

$ solfuzz

COMMANDS:
	check [options] <solidity_file> [contract_name]				Check the given smart contract
	list									Get a list of submitted jobs
	status <UUID>								Get the status of an already submitted job
	version									Print version
	help									Print help message

	
OPTIONS:
	--mode <quick/standard/deep>						Analysis mode (default=quick)
	--format <text/eslint> 							Output format (default=text)
	--debug                                         			Print API request and response
`;

module.exports = async () => {
    console.log(helpText);
};
