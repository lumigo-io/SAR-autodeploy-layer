const _ = require('lodash')
const AWS = require('./aws')

const mockListFunctions = jest.fn()
AWS.Lambda.prototype.listFunctions = mockListFunctions

const Lambda = require('./lambda')

afterEach(() => {
  mockListFunctions.mockClear()
})

test('listFunctions gets all functions recursively', async () => {
  const response = n => ({
    promise: () => Promise.resolve({
      Functions: _.range(0, n).map(_ => ({
        FunctionArn: 'some-arn'
      })),
      NextMarker: n === 10 ? 'more..' : undefined
    })
  })

  mockListFunctions.mockReturnValueOnce(response(10))
  mockListFunctions.mockReturnValueOnce(response(10))
  mockListFunctions.mockReturnValueOnce(response(1))

  const functions = await Lambda.listFunctions()
  expect(functions).toHaveLength(21)
})
