const express = require('express');
const router = express.Router();
const { getIngredientPrice } = require('../services/priceService');
const { splitIngredients } = require('../utils/ingredientUtils');
const { runMachineLearningModel } = require('../services/mlService');
const { API_KEY } = require('../config/env');

router.post('/submit', async (req, res) => {
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
        const recipesWithPrices = await Promise.all(apiResult.COOKRCP01.row.map(async (recipe) => {
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