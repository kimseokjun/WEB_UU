const { spawn } = require('child_process');

async function runMachineLearningModel(recipes) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['god1.py', JSON.stringify(recipes)]);

        let result = '';

        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python 에러: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python 프로세스 종료 코드: ${code}`));
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = { runMachineLearningModel };