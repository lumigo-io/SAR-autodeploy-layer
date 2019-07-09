const Lambda = require("./lib/lambda");

const mockListFunctions = jest.fn();
Lambda.listFunctions = mockListFunctions;
const mockListTags = jest.fn();
Lambda.listTags = mockListTags;
const mockGetConfiguration = jest.fn();
Lambda.getConfiguration = mockGetConfiguration;
const mockUpdateConfiguration = jest.fn();
Lambda.updateConfiguration = mockUpdateConfiguration;

const layerArn = "arn:aws:lambda:us-east-1:374852340823:layer:optimized-aws-sdk:8";
process.env.LAYER_ARN = layerArn;

afterEach(() => {
	mockListTags.mockClear();
	mockListFunctions.mockClear();
	mockGetConfiguration.mockClear();
	mockUpdateConfiguration.mockClear();

	delete process.env.INCLUDE_TAG;
	delete process.env.EXCLUDE_TAG;
});

describe("new function", () => {
	const handler = require("./add-layer").newFunction;

	const event = {
		detail: {
			responseElements: {
				functionName: "test",
				functionArn: "arn:aws:lambda:us-east-1:1234567890:function:test"
			}
		}
	};

	describe("if no INCLUDE_TAG and EXCLUDE_TAG", () => {
		test("layer is deployed", async () => {
			mockGetConfiguration.mockResolvedValue({ Layers: [] });
			mockListTags.mockResolvedValue([]);

			await handler(event);

			expect(mockUpdateConfiguration).toBeCalled();
		});
	});

	describe("if INCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given.include_tag_is_configured();
		});

		test("layer is deployed if function has matching tag", async () => {
			given
				.function_has_include_tag()
				.function_has_no_layers();

			await handler(event);

			expect(mockUpdateConfiguration).toBeCalled();
		});

		test("layer is not deployed if function does not have matching tag", async () => {
			given.function_has_no_tags();

			await handler(event);

			expect(mockUpdateConfiguration).not.toBeCalled();
		});
	});

	describe("if EXCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given.exclude_tag_is_configured();
		});

		test("should ignore function that has matching tag", async () => {
			given.function_has_exclude_tag();

			await handler(event);

			expect(mockUpdateConfiguration).not.toBeCalled();
		});

		test("should deploy layer to function that does not have matching tag", async () => {
			given
				.function_has_no_tags()
				.function_has_no_layers();

			await handler(event);

			expect(mockUpdateConfiguration).toBeCalled();
		});
	});

	describe("if both INCLUDE_TAG and EXCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given
				.include_tag_is_configured()
				.exclude_tag_is_configured();
		});

		test("should ignore function with matching both include and exclude tag", async () => {
			given
				.function_has_both_tags()
				.function_has_no_layers();

			await handler(event);

			expect(mockUpdateConfiguration).not.toBeCalled();
		});
	});

	describe("autodeploy layer", () => {
		test("layer is not deployed if function already has it", async () => {
			given.function_has_layer(layerArn);

			await handler(event);

			expect(mockUpdateConfiguration).not.toBeCalled();
		});

		test("layer is deployed if function does not have it", async () => {
			given.function_has_no_layers();

			await handler(event);

			expect(mockUpdateConfiguration).toBeCalled();
			const [functionName, newLayers] = mockUpdateConfiguration.mock.calls[0];
			expect(functionName).toBe("test");
			expect(newLayers).toEqual([ layerArn ]);
		});

		test("layer is replaced if function has older version", async () => {
			const arn = "arn:aws:lambda:us-east-1:374852340823:layer:optimized-aws-sdk:7";
			given.function_has_layer(arn);

			await handler(event);

			expect(mockUpdateConfiguration).toBeCalled();
			const [functionName, newLayers] = mockUpdateConfiguration.mock.calls[0];
			expect(functionName).toBe("test");
			expect(newLayers).toEqual([ layerArn ]);
		});
	});
});

describe("existing functions", () => {
	const handler = require("./add-layer").existingFunctions;

	describe("if no INCLUDE_TAG and EXCLUDE_TAG", () => {
		test("layer is deployed to all functions", async () => {
			given.existing_functions([ {
				functionName: "test-1"
			}, {
				functionName: "test-2"
			}, {
				functionName: "test-3"
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalledTimes(3);
		});
	});

	describe("if INCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given.include_tag_is_configured();
		});

		test("layer is deployed only for functions that matching tag", async () => {
			given.existing_functions([ {
				functionName: "test-1",
				hasIncludeTag: true
			}, {
				functionName: "test-2",
				hasIncludeTag: true
			}, {
				functionName: "test-3",
				hasIncludeTag: false
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalledTimes(2);
		});
	});

	describe("if EXCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given.exclude_tag_is_configured();
		});

		test("should ignore functions that match the exclude prefix", async () => {
			given.existing_functions([ {
				functionName: "test-1",
				hasExcludeTag: false
			}, {
				functionName: "test-2",
				hasExcludeTag: false
			}, {
				functionName: "test-3",
				hasExcludeTag: true
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalledTimes(2);
		});
	});

	describe("if both INCLUDE_TAG and EXCLUDE_TAG is configured", () => {
		beforeEach(() => {
			given
				.include_tag_is_configured()
				.exclude_tag_is_configured();
		});

		test("should ignore function with matching both include and exclude tag", async () => {
			given.existing_functions([ {
				functionName: "test-1",
				hasIncludeTag: true,
				hasExcludeTag: true
			}, {
				functionName: "test-2",
				hasIncludeTag: false,
				hasExcludeTag: false
			}, {
				functionName: "test-3",
				hasIncludeTag: true,
				hasExcludeTag: false
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalledTimes(1);
			const [functionName, newLayers] = mockUpdateConfiguration.mock.calls[0];
			expect(functionName).toBe("test-3");
			expect(newLayers).toEqual([ layerArn ]);
		});
	});

	describe("autodeploy layer", () => {
		describe("layer is only deployed for functions that do not have it", async () => {
			given.existing_functions([ {
				functionName: "test-1",
				hasLatestLayer: true
			}, {
				functionName: "test-2",
				hasLatestLayer: true
			}, {
				functionName: "test-3",
				hasLatestLayer: false
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalledTimes(1);
			const [functionName, newLayers] = mockUpdateConfiguration.mock.calls[0];
			expect(functionName).toBe("test-3");
			expect(newLayers).toEqual([ layerArn ]);
		});

		describe("layer is replaced if function has older version", async () => {
			given.existing_functions([ {
				functionName: "test-1",
				hasLatestLayer: true
			}, {
				functionName: "test-2",
				hasLatestLayer: false,
				hasOldLayer: true
			}]);

			await handler();

			expect(mockUpdateConfiguration).toBeCalled();
			const [functionName, newLayers] = mockUpdateConfiguration.mock.calls[0];
			expect(functionName).toBe("test-2");
			expect(newLayers).toEqual([ layerArn ]);
		});
	});
});

const given = {};

given.include_tag_is_configured = () => {
	process.env.INCLUDE_TAG = "optimize-aws-sdk";
	return given;
};

given.exclude_tag_is_configured = () => {
	process.env.EXCLUDE_TAG = "no-optimize-aws-sdk";
	return given;
};

given.function_has_no_tags = () => {
	mockListTags.mockResolvedValue([]);
	return given;
};

given.function_has_include_tag = () => {
	mockListTags.mockResolvedValue(["optimize-aws-sdk"]);
	return given;
};

given.function_has_exclude_tag = () => {
	mockListTags.mockResolvedValue(["no-optimize-aws-sdk"]);
	return given;
};

given.function_has_both_tags = () => {
	mockListTags.mockResolvedValue(["optimize-aws-sdk", "no-optimize-aws-sdk"]);
	return given;
};

given.function_has_no_layers = () => {
	mockGetConfiguration.mockResolvedValue({ Layers: [] });
	return given;
};

given.function_has_layer = (layerArn) => {
	mockGetConfiguration.mockResolvedValue({
		Layers: [{
			Arn: layerArn
		}]
	});

	return given;
};

given.existing_functions = (functions) => {
	const listFunctionsResp = [];
	for (const { functionName, hasIncludeTag, hasExcludeTag, hasLatestLayer, hasOldLayer } of functions) {
		listFunctionsResp.push({
			functionName,
			functionArn: `arn:aws:lambda:us-east-1:1234567890:function:${functionName}`
		});

		if (hasIncludeTag && hasExcludeTag) {
			mockListTags.mockResolvedValueOnce(["optimize-aws-sdk", "no-optimize-aws-sdk"]);
		} else if (hasIncludeTag) {
			mockListTags.mockResolvedValueOnce(["optimize-aws-sdk"]);
		} else if (hasExcludeTag) {
			mockListTags.mockResolvedValueOnce(["no-optimize-aws-sdk"]);
		} else {
			mockListTags.mockResolvedValueOnce([]);
		}

		if (hasLatestLayer) {
			mockGetConfiguration.mockResolvedValueOnce({
				Layers: [{
					Arn: layerArn
				}]
			});
		} else if (hasOldLayer) {
			mockGetConfiguration.mockResolvedValueOnce({
				Layers: [{
					Arn: "arn:aws:lambda:us-east-1:374852340823:layer:optimized-aws-sdk:7"
				}]
			});
		} else {
			mockGetConfiguration.mockResolvedValueOnce({ Layers: [] });
		}
	}

	mockListFunctions.mockResolvedValue(listFunctionsResp);
};
