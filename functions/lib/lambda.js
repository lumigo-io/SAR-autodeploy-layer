const AWS = require("./aws");
const Lambda = new AWS.Lambda();

const listTags = async (functionArn) => {
	const resp = await Lambda
		.listTags({ Resource: functionArn })
		.promise();
	return Object.keys(resp.Tags);
};

const listFunctions = async () => {
	console.log("listing all available functions...");

	const loop = async (acc = [], marker) => {
		const params = {
			Marker: marker,
			MaxItems: 10
		};

		const res = await Lambda.listFunctions(params).promise();
		const functions = res.Functions.map(x => ({
			functionName: x.FunctionName,
			functionArn: x.FunctionArn
		}));
		const newAcc = acc.concat(functions);

		if (res.NextMarker) {
			return loop(newAcc, res.NextMarker);
		} else {
			// Shuffle newAcc array
			return newAcc.sort(() => Math.random() - Math.random());
		}
	};

	return loop();
};

const getConfiguration = async (functionName) => {
	const resp = await Lambda
		.getFunctionConfiguration({ FunctionName: functionName })
		.promise();
	return resp;
};

const updateConfiguration = async (functionName, layers) => {
	const req = {
		FunctionName: functionName,
		Layers: layers
	};
	await Lambda
		.updateFunctionConfiguration(req)
		.promise();
};

module.exports = {
	listTags,
	listFunctions,
	getConfiguration,
	updateConfiguration
};
