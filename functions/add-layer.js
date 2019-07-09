const Lambda = require("./lib/lambda");

const { LAYER_ARN } = process.env;
const { layer: LAYER, version: LAYER_VERSION } = getLayerAndVersion(LAYER_ARN);

module.exports.newFunction = async (event) => {
	console.log(JSON.stringify(event));

	const { functionName, functionArn } = event.detail.responseElements;
	console.log(`function name: ${functionName}`);

	const proceed = await filter(functionName, functionArn);

	if (proceed) {
		await autodeploy(functionName);
	}
};

let functions = [];

module.exports.existingFunctions = async () => {
	if (functions.length === 0) {
		functions = await Lambda.listFunctions();
		console.log(`found ${functions.length} functions in region`);
	}

	// clone the functions that are left to do so that as we iterate with it we
	// can remove updated functions from 'functions'
	const toUpdate = [];
	for (let { functionName, functionArn } of functions) {
		const proceed = await filter(functionName, functionArn);
		if (proceed) {
			toUpdate.push(functionName);
		}
	}

	console.log(`${toUpdate.length} functions to update:\n`, toUpdate);

	for (const functionName of toUpdate) {
		await autodeploy(functionName);
		functions = functions.filter(x => x.functionName !== functionName);
	}

	console.log("all done");
	functions = [];
};

async function filter (functionName, functionArn) {
	const { INCLUDE_TAG, EXCLUDE_TAG } = process.env;
	const tags = await Lambda.listTags(functionArn);

	if (EXCLUDE_TAG && tags.includes(EXCLUDE_TAG)) {
		console.log(`ignored the function [${functionName}] because it has the exclude tag [${EXCLUDE_TAG}]`);
		return false;
	}

	if (INCLUDE_TAG && !tags.includes(INCLUDE_TAG)) {
		console.log(`ignored the function [${functionName}] because it doesn't has the include tag [${INCLUDE_TAG}]`);
		return false;
	}

	return true;
}

async function autodeploy (functionName) {
	const funcConfig = await Lambda.getConfiguration(functionName);
	funcConfig.Layers = funcConfig.Layers || [];
	const layers = funcConfig.Layers.map(({ Arn }) => Arn);

	if (layers.includes(LAYER_ARN)) {
		console.log(`function [${functionName}] already has the layer, skipped...`);
		return;
	}

	const newLayers = layers
		.filter(arn => {
			const { layer, version } = getLayerAndVersion(arn);

			if (layer === LAYER) {
				console.log(`function [${functionName}] has previous version [${version}] of layer, replacing with version [${LAYER_VERSION}]...`);
				return false;
			}

			return true;
		})
		.concat(LAYER_ARN);

	try {
		await Lambda.updateConfiguration(functionName, newLayers);
		console.log(`layer [${LAYER_ARN}] has been deployed to function [${functionName}]`);
	} catch (err) {
		console.log(`failed to deploy [${LAYER_ARN}] to function [${functionName}]`, err);
	}
}

function getLayerAndVersion (arn) {
	const idx = arn.lastIndexOf(":");
	return {
		layer: arn.slice(0, idx),
		version: arn.slice(idx + 1)
	};
}
