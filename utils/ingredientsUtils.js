function cleanIngredient(ingredient) {
    return ingredient
        .replace(/\d+(\s*)(g|kg|ml|l|개|마리|캔|봉|장|모|팩|줄|알|cc|방울|스푼|컵|숟가락|가래|조각|쪽|mg|근|분|큰술|작은술)/gi, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[~!@#$%^&*()_+|<>?:{}\/]/g, '')
        .trim();
}

function splitIngredients(ingredientString) {
    const separators = [',', '·', '+', '/', ':', ';'];
    let ingredients = [ingredientString];

    for (let separator of separators) {
        ingredients = ingredients
            .flatMap(item => item.split(separator))
            .map(item => item.trim())
            .filter(item => item.length > 0);
    }

    return ingredients
        .map(cleanIngredient)
        .filter(ingredient =>
            ingredient.length > 0 &&
            ingredient.length <= 10 &&
            /^[가-힣]+$/.test(ingredient)
        );
}

module.exports = {
    cleanIngredient,
    splitIngredients
};