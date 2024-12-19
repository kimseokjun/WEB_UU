require('dotenv').config(); // 환경 변수 로딩
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // 동적 import
var client_id = '_vY5OvRquLzeCuppekBP';
var client_secret = 'CAkzJC54wC';
var request = require('request');
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY; // API 키 환경 변수에서 로드
// 전역 변수 설정
let currentRecipe = null;
let learningChart = null;
let feedbackHistory = [];
// MongoDB 연결 설정
const mongoUrl = 'mongodb://localhost:27017'; // MongoDB URI
const dbName = 'WEB_UU'; // DB 이름
const collectionName = 'food_name'; // 컬렉션 이름

let db, collection;

MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
    .then((client) => {
        db = client.db(dbName);
        collection = db.collection(collectionName);
        console.log('MongoDB connected successfully!');
    })
    .catch((error) => console.error('MongoDB connection error:', error));

// Middleware
app.use(bodyParser.json());
app.use(express.static(__dirname)); // HTML 파일을 서빙

// 레시피 검색 API 엔드포인트
// 레시피 검색 API 엔드포인트
app.post('/submit', async (req, res) => {
    try {
        const { ingredients } = req.body;

        if (!ingredients) {
            return res.status(400).json({ message: '재료를 입력해주세요.' });
        }

        const firstIngredient = ingredients.split(',')[0].trim();
        if (!firstIngredient) {
            return res.status(400).json({ message: '유효한 재료를 입력해주세요.' });
        }

        const apiUrl = `https://openapi.foodsafetykorea.go.kr/api/${API_KEY}/COOKRCP01/json/1/5/RCP_PARTS_DTLS='${encodeURIComponent(firstIngredient)}'`;

        const apiResponse = await fetch(apiUrl);

        if (!apiResponse.ok) {
            throw new Error('외부 API 호출 실패');
        }

        const apiResult = await apiResponse.json();

        // API 응답에서 레시피 데이터 추출 및 가격 계산
        const recipesWithPrices = await Promise.all(apiResult.COOKRCP01.row.map(async (recipe) => {
            // 가격 계산 (로그 출력 없이)
            const ingredientsArray = splitIngredients(recipe.RCP_PARTS_DTLS);
            let totalPrice = 0;
            for (let ingredient of ingredientsArray) {
                const price = await getIngredientPrice(ingredient);
                totalPrice += price;
            }

            return {
                RCP_PARTS_DTLS: recipe.RCP_PARTS_DTLS,
                RCP_WAY2: recipe.RCP_WAY2,
                RCP_PAT2: recipe.RCP_PAT2,
                RCP_NM: recipe.RCP_NM,
                INFO_ENG: recipe.INFO_ENG,
                INFO_CAR: recipe.INFO_CAR,
                INFO_PRO: recipe.INFO_PRO,
                INFO_FAT: recipe.INFO_FAT,
                INFO_NA: recipe.INFO_NA,
                totalPrice: totalPrice
            };
        }));

        res.json({
            message: '레시피를 성공적으로 검색하고 전송했습니다.',
            recipes: recipesWithPrices,
        });
    } catch (error) {
        console.error('오류 발생:', error);
        res.status(500).json({ message: '서버에서 오류가 발생했습니다.', error: error.message });
    }
});
// // 레시피 저장 API 엔드포인트
// app.post('/saveRecipe', async (req, res) => {
//     try {
//         const { RCP_PARTS_DTLS, RCP_WAY2, RCP_PAT2, RCP_NM, INFO_ENG, INFO_CAR, INFO_PRO, INFO_FAT, INFO_NA } = req.body;
//         const ingredientsArray = splitIngredients(RCP_PARTS_DTLS);
//         let totalPrice = 0;
//         for (let ingredient of ingredientsArray) {
//             const price = await getIngredientPrice(ingredient);
//             totalPrice += price;
//         }

//         if (!RCP_PARTS_DTLS || !RCP_WAY2 || !RCP_PAT2 || !RCP_NM || !INFO_ENG) {
//             return res.status(400).json({ message: '모든 레시피 정보를 입력해주세요.' });
//         }

//         console.log('Total price of ingredients:', totalPrice);
//         // MongoDB에 저장
//         await collection.insertOne({
//             RCP_PARTS_DTLS,
//             RCP_WAY2,
//             RCP_PAT2,
//             RCP_NM,
//             INFO_ENG, INFO_CAR, INFO_PRO, INFO_FAT, INFO_NA, totalPrice
//         });


//         console.log('선택한 레시피가 MongoDB에 저장되었습니다.');

//         res.json({ message: '레시피가 성공적으로 저장되었습니다.' });
//     } catch (error) {
//         console.error('레시피 저장 오류:', error);
//         res.status(500).json({ message: '레시피 저장 중 오류가 발생했습니다.', error: error.message });
//     }
// });



// 머신러닝 추천 API 엔드포인트
app.get('/recommendRecipe', async (req, res) => {
    try {
        // MongoDB에서 모든 레시피 데이터 가져오기
        const recipes = await collection.find({}).toArray();

        if (recipes.length === 0) {
            return res.status(400).json({ message: '저장된 레시피가 없습니다.' });
        }

        // 머신러닝 모델 실행
        const recommendedRecipe = await runMachineLearningModel(recipes);

        // 결과 반환
        res.json({ recommendedRecipe });
    } catch (error) {
        console.error('추천 레시피 조회 오류:', error);
        res.status(500).json({ message: '서버에서 오류가 발생했습니다.', error: error.message });
    }
});
// 서버 측 코드 (Node.js)

app.post('/getRecipe', async (req, res) => {
    try {
        const recipes = await collection.find({}).toArray();

        if (recipes.length === 0) {
            return res.status(400).json({ message: '저장된 레시피가 없습니다.' });
        }

        // 첫 번째 레시피를 예시로 보냄
        res.json({
            message: '레시피 정보 전송 성공',
            recipe: recipes[0] // 첫 번째 레시피 정보
        });
    } catch (error) {
        console.error('오류 발생:', error);
        res.status(500).json({ message: '서버에서 오류가 발생했습니다.', error: error.message });
    }
});
app.post('/saveFeedback', async (req, res) => {
    try {
        const { recipe, feedback } = req.body;

        if (!recipe || !feedback) {
            return res.status(400).json({ message: '필요한 데이터를 모두 입력해주세요.' });
        }

        // 기존 레시피 검색
        const existingRecipe = await collection.findOne({ RCP_NM: recipe.RCP_NM });

        if (existingRecipe) {
            const ingredientsArray = splitIngredients(recipe.RCP_PARTS_DTLS);
            let totalPrice = 0;
            for (let ingredient of ingredientsArray) {
                const price = await getIngredientPrice(ingredient, true);
                totalPrice += price;
            }
            // 기존 레시피 업데이트
            const feedbacks = existingRecipe.feedbacks || [];
            feedbacks.push({
                feedback: feedback,
                createdAt: new Date()
            });

            // 피드백 통계 업데이트
            const positiveFeedbacks = feedbacks.filter(f => f.feedback === '좋아요').length;
            const negativeFeedbacks = feedbacks.filter(f => f.feedback === '싫어요').length;

            await collection.updateOne(
                { RCP_NM: recipe.RCP_NM },
                {
                    $set: {
                        feedbacks: feedbacks,
                        positiveFeedbacks: positiveFeedbacks,
                        negativeFeedbacks: negativeFeedbacks,
                        totalFeedbacks: feedbacks.length,
                        lastUpdated: new Date()
                    }
                }
            );
        } else {
            // 새로운 레시피 첫 저장 (가격 계산 시 로그 출력)
            const ingredientsArray = splitIngredients(recipe.RCP_PARTS_DTLS);
            let totalPrice = 0;
            for (let ingredient of ingredientsArray) {
                const price = await getIngredientPrice(ingredient, true); // 로그 출력 활성화
                totalPrice += price;
            }

            const recipeDocument = {
                RCP_PARTS_DTLS: recipe.RCP_PARTS_DTLS,
                RCP_WAY2: recipe.RCP_WAY2,
                RCP_PAT2: recipe.RCP_PAT2,
                RCP_NM: recipe.RCP_NM,
                INFO_ENG: recipe.INFO_ENG,
                INFO_CAR: recipe.INFO_CAR,
                INFO_PRO: recipe.INFO_PRO,
                INFO_FAT: recipe.INFO_FAT,
                INFO_NA: recipe.INFO_NA,
                totalPrice: totalPrice,
                feedbacks: [{
                    feedback: feedback,
                    createdAt: new Date()
                }],
                positiveFeedbacks: feedback === '좋아요' ? 1 : 0,
                negativeFeedbacks: feedback === '싫어요' ? 1 : 0,
                totalFeedbacks: 1,
                createdAt: new Date()
            };

            await collection.insertOne(recipeDocument);
        }

        res.json({ message: '피드백이 성공적으로 저장되었습니다.' });
    } catch (error) {
        console.error('피드백 저장 오류:', error);
        res.status(500).json({
            message: '피드백 저장 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});
const { spawn } = require('child_process'); // child_process 모듈에서 spawn 함수 불러오기

// 머신러닝 모델 실행 함수 (Python 코드 실행)
async function runMachineLearningModel(recipes) {
    return new Promise((resolve, reject) => {
        // Python 스크립트 실행
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

function cleanIngredient(ingredient) {
    return ingredient
        // 숫자와 단위 제거
        .replace(/\d+(\s*)(g|kg|ml|l|개|마리|캔|봉|장|모|팩|줄|알|cc|방울|스푼|컵|숟가락|가래|조각|쪽|mg|근|분|큰술|작은술)/gi, '')
        // 괄호와 그 안의 내용 제거
        .replace(/\([^)]*\)/g, '')
        // 특수문자 제거
        .replace(/[~!@#$%^&*()_+|<>?:{}\/]/g, '')
        // 불필요한 조사 제거
        // .replace(/(은|는|을|를|의|와|과|로|으로|도|만|처럼|같이)$/g, '')
        // 앞뒤 공백 제거
        .trim();
}
function splitIngredients(ingredientString) {
    // 구분자로 재료 분리
    const separators = [',', '·', '+', '/', ':', ';'];
    let ingredients = [ingredientString];

    for (let separator of separators) {
        ingredients = ingredients
            .flatMap(item => item.split(separator))
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    // 각 재료 정제
    return ingredients
        .map(cleanIngredient)
        .filter(ingredient =>
            ingredient.length > 0 &&
            ingredient.length <= 10 && // 너무 긴 문자열 제외
            /^[가-힣]+$/.test(ingredient) // 한글만 포함된 재료명만 선택
        );


}

function getIngredientPrice(ingredient, shouldLog = false) {
    return new Promise((resolve, reject) => {
        const cleanedIngredient = cleanIngredient(ingredient);

        if (!cleanedIngredient || cleanedIngredient.length < 1) {
            if (shouldLog) {
                console.log(`재료 "${ingredient}" 정제 후 빈 문자열`);
            }
            resolve(0);
            return;
        }

        const api_url = 'https://openapi.naver.com/v1/search/shop?query=' + encodeURI(cleanedIngredient + ' 식재료');
        const options = {
            url: api_url,
            headers: {
                'X-Naver-Client-Id': client_id,
                'X-Naver-Client-Secret': client_secret
            }
        };

        request.get(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                try {
                    const data = JSON.parse(body);
                    if (data.items && data.items.length > 0) {
                        // 식품 카테고리 유지하면서 필터링 조건 완화
                        const filteredItems = data.items.filter(item => {
                            const title = item.title.toLowerCase();
                            // 식품 카테고리 체크
                            const isFood = item.category1 === '식품' ||
                                item.category2 === '식품' ||
                                title.includes('식품') ||
                                title.includes('식재료');

                            // 제외할 키워드 체크 (대량 판매 상품만 제외)
                            const hasExcludeWord = title.includes('10kg') ||
                                title.includes('20kg') ||
                                title.includes('50kg') ||
                                title.includes('100개') ||
                                title.includes('200개');

                            return isFood && !hasExcludeWord;
                        });

                        if (filteredItems.length > 0) {
                            const minPrice = Math.min(...filteredItems.map(item => parseInt(item.lprice)));
                            if (shouldLog) {
                                console.log(`재료: ${cleanedIngredient} =>  최저가: ${minPrice}원`);
                            }
                            resolve(minPrice);
                            return;
                        }
                    }
                    if (shouldLog) {
                        console.log(`재료: ${cleanedIngredient}, 가격: 검색 결과 없음`);
                    }
                    resolve(0);
                } catch (parseError) {
                    if (shouldLog) {
                        console.error(`JSON 파싱 오류: ${parseError}`);
                    }
                    resolve(0);
                }
            } else {
                if (shouldLog) {
                    console.error(`API 요청 오류: ${error}`);
                }
                resolve(0);
            }
        });
    });
}

function extractIngredients(input) {
    // 모든 줄을 하나의 줄로 합침
    const cleanedInput = input
        .replace(/양념장\s*:/g, '') // "양념장 :" 제거
        .replace(/고명\s*:/g, '') // "고명 :" 제거
        .replace(/소스\s*:/g, '') // "소스 :" 제거
        .replace(/국물\s*:/g, '') // "소스 :" 제거
        .replace(/쌀뜨물\s*:/g, '') // "소스 :" 제거
        .replace(/쌀\s*:/g, '') // "소스 :" 제거
        .replace(/\s+/g, ' ') // 연속된 공백을 하나로
        .replace(/\n+/g, ' ') // 줄바꿈을 공백으로 변경
        .replace(/[0-9½]+\s*[a-z가-힣()]*\s*(큰술|컵|그람|ml|리터)?|\([^)]*\)/g, '') // 숫자, 단위(예: ½큰술, ½컵) 및 괄호 제거
        .trim();

    // 쉼표를 기준으로 재료 분리하고 불필요한 공백 제거
    const ingredients = cleanedInput.split(/\s+/)
        .filter(word => word.trim().length > 0)  // 공백 단어 제외
        .filter(word => /^[가-힣]+$/.test(word));

    return ingredients;
}




// // 신규 엔드포인트: 재료 가격 조회
// app.get('/ingredientPrice', async (req, res) => {
//     try {
//         const ingredient = req.query.ingredient;
//         if (!ingredient) {
//             return res.status(400).json({ message: '재료를 입력해주세요.' });
//         }

//         const price = await getIngredientPrice(ingredient);
//         res.json({ price });
//     } catch (error) {
//         console.error('재료 가격 조회 오류:', error);
//         res.status(500).json({ message: '서버에서 오류가 발생했습니다.', error: error.message });
//     }
// });


app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다.`);
});
