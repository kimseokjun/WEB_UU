const request = require('request');
const { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } = require('../config/env');
const { cleanIngredient } = require('../utils/ingredientUtils');

function getIngredientPrice(ingredient) {
    return new Promise((resolve, reject) => {
        const cleanedIngredient = cleanIngredient(ingredient);

        if (!cleanedIngredient || cleanedIngredient.length < 1) {
            console.log(`재료 "${ingredient}" 정제 후 빈 문자열`);
            resolve(0);
            return;
        }

        const api_url = 'https://openapi.naver.com/v1/search/shop?query=' + encodeURI(cleanedIngredient + ' 식재료');
        const options = {
            url: api_url,
            headers: {
                'X-Naver-Client-Id': NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
            }
        };

        request.get(options, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                try {
                    const data = JSON.parse(body);
                    if (data.items && data.items.length > 0) {
                        const validItems = data.items.filter(item => {
                            const price = parseInt(item.lprice);
                            return (
                                (item.category1 === '식품' || item.category2 === '식품') &&
                                price > 100 &&
                                price < 30000 &&
                                !item.title.includes('세트') &&
                                !item.title.includes('묶음') &&
                                !item.title.includes('박스') &&
                                !item.title.includes('대용량')
                            );
                        });

                        if (validItems.length > 0) {
                            const prices = validItems.map(item => parseInt(item.lprice));
                            const avgPrice = Math.round(prices.reduce((a, b) => a + b) / prices.length);
                            console.log(`재료: ${cleanedIngredient}, 평균가격: ${avgPrice}원`);
                            resolve(avgPrice);
                            return;
                        }
                    }
                    console.log(`재료: ${cleanedIngredient}, 가격: 검색 결과 없음`);
                    resolve(0);
                } catch (parseError) {
                    console.error(`JSON 파싱 오류: ${parseError}`);
                    resolve(0);
                }
            } else {
                console.error(`API 요청 오류: ${error}`);
                resolve(0);
            }
        });
    });
}

module.exports = { getIngredientPrice };