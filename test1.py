import sys
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
import sys
sys.stdout.reconfigure(encoding='utf-8')
# 서버에서 전송받은 레시피 데이터를 받아옴
input_data = json.loads(sys.argv[1])

# 예시로 요리종류 예측 (필요한 경우 수정 가능)
recipes = input_data
recipe_names = [recipe['RCP_NM'] for recipe in recipes]
ingredients = [recipe['RCP_PARTS_DTLS'] for recipe in recipes]  # 실제로 사용할 데이터로 변경

# LabelEncoder 예시 (요리명을 라벨로 변환)
label_encoder = LabelEncoder()
y = label_encoder.fit_transform(recipe_names)

# 피처(ingredient)를 숫자로 변환하기 위한 예시
# 실제 사용시, 재료 데이터를 적절히 벡터화하거나 처리해야 함
X = [[len(ingredient)] for ingredient in ingredients]  # 예시: 재료의 길이로 피처 생성

# 학습 데이터와 테스트 데이터 분리
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# 랜덤포레스트 모델 학습
model = RandomForestClassifier(random_state=42)
model.fit(X_train, y_train)

# 예측
y_pred = model.predict(X_test)

# 예측된 가장 많이 나온 요리 종류 반환
predicted_recipe = label_encoder.inverse_transform([y_pred[0]])  # 가장 첫 번째 예측값

print(predicted_recipe[0])  # 예측된 요리 이름 출력
