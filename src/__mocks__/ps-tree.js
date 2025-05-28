// Mock implementation of ps-tree
const mockPsTree = jest.fn().mockImplementation((pid, callback) => {
	// Mock process tree data
	const mockProcesses = [
		{
			PID: pid.toString(),
			PPID: '1',
			COMMAND: 'node',
			STAT: 'S',
			TIME: '00:00:01',
		},
		{
			PID: (parseInt(pid) + 1).toString(),
			PPID: pid.toString(),
			COMMAND: 'child-process',
			STAT: 'S',
			TIME: '00:00:00',
		},
	]

	// Simulate async behavior
	if (callback && typeof callback === 'function') {
		setTimeout(() => {
			callback(null, mockProcesses)
		}, 10)
	}

	return mockProcesses
})

module.exports = mockPsTree
module.exports.default = mockPsTree
module.exports.__esModule = true
