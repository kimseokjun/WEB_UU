import sys
import json
import numpy as np
import random
from collections import defaultdict
from pymongo import MongoClient
import datetime
import traceback
import sys
sys.stdout.reconfigure(encoding='utf-8')

class RecipeRecommender:
    def __init__(self):
        try:
            self.q_table = defaultdict(lambda: defaultdict(float))
            self.learning_rate = 0.1
            self.discount_factor = 0.9
            self.epsilon = 0.1
            
            # MongoDB 연결 설정
            self.client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
            self.client.server_info()
            self.db = self.client['WEB_UU']
            self.collection = self.db['food_name']
            print("MongoDB 연결 성공")
        except Exception as e:
            print(f"MongoDB 연결 오류: {str(e)}")
            raise

    def load_training_data(self):
        try:
            cursor = self.collection.find({})
            recipes = list(cursor)
            print(f"데이터베이스에서 {len(recipes)}개의 레시피를 불러옴")
            return recipes
        except Exception as e:
            print(f"데이터 로딩 오류: {str(e)}")
            return []

    def get_state(self, recipe):
        try:
            energy = float(recipe.get('INFO_ENG', 0))
            protein = float(recipe.get('INFO_PRO', 0))
            fat = float(recipe.get('INFO_FAT', 0))
            price = float(recipe.get('totalPrice', 0))
            
            return (
                round(energy, -1),
                round(protein, 0),
                round(fat, 0),
                round(price, -3)
            )
        except Exception as e:
            print(f"상태 변환 오류 (레시피: {recipe.get('RCP_NM', 'Unknown')}): {str(e)}")
            return (0, 0, 0, 0)

    def get_reward(self, recipe):
        try:
            # 누적된 피드백 분석
            positive = float(recipe.get('positiveFeedbacks', 0))
            negative = float(recipe.get('negativeFeedbacks', 0))
            total = positive + negative
            
            # 피드백 기반 기본 보상 계산
            if total > 0:
                base_reward = (positive - negative) / total
            else:
                base_reward = 0

            # 영양소 균형과 가격을 고려한 보상 조정
            price = float(recipe.get('totalPrice', 0))
            protein = float(recipe.get('INFO_PRO', 0))
            fat = float(recipe.get('INFO_FAT', 0))
            energy = float(recipe.get('INFO_ENG', 0))
            
            # 보상 계산
            price_penalty = -0.1 * (price / 10000) if price > 0 else 0
            protein_bonus = 0.05 * protein if protein > 0 else 0
            fat_penalty = -0.05 * (fat / 20) if fat > 0 else 0
            
            RECOMMENDED_CALORIES = 700
            energy_penalty = -0.1 * ((energy - RECOMMENDED_CALORIES) / 100) if energy > RECOMMENDED_CALORIES else 0
            
            # 피드백 수에 따른 가중치
            feedback_weight = min(total / 10, 1.0)
            
            # 최종 보상 계산
            total_reward = (base_reward * feedback_weight) + \
                          price_penalty + \
                          protein_bonus + \
                          fat_penalty + \
                          energy_penalty
            
            return max(-1, min(1, total_reward))
            
        except Exception as e:
            print(f"보상 계산 오류 (레시피: {recipe.get('RCP_NM', 'Unknown')}): {str(e)}")
            return 0
    def train(self):
        try:
            recipes = self.load_training_data()
            if not recipes:
                print("훈련할 데이터가 없습니다.")
                return
            
            print(f"{len(recipes)}개의 레시피로 학습을 시작합니다.")
            
            # 에피소드 반복
            for episode in range(50):
                random.shuffle(recipes)
                total_reward = 0
                
                # 각 레시피에 대해
                for recipe in recipes:
                    current_state = self.get_state(recipe)
                    recipe_name = recipe['RCP_NM']
                    
                    # 1. 기본 보상 계산
                    base_reward = self.get_reward(recipe)
                    
                    # 2. 영양 균형 패턴 학습
                    nutrition_balance = self.calculate_nutrition_balance(recipe)
                    
                    # 3. 가격대비 영양가치 학습
                    value_for_money = self.calculate_value_for_money(recipe)
                    
                    # 4. 선호도 패턴 학습
                    preference_pattern = self.analyze_preference_pattern(recipe)
                    
                    # 종합 보상 계산
                    total_reward_for_recipe = (
                        base_reward + 
                        nutrition_balance * self.q_table[current_state].get('nutrition', 0) +
                        value_for_money * self.q_table[current_state].get('value', 0) +
                        preference_pattern * self.q_table[current_state].get('preference', 0)
                    )
                    
                    # Q-테이블 업데이트
                    old_value = self.q_table[current_state][recipe_name]
                    new_value = (1 - self.learning_rate) * old_value + \
                            self.learning_rate * total_reward_for_recipe
                    
                    # 각 특성별 가중치 업데이트
                    self.q_table[current_state]['nutrition'] = nutrition_balance
                    self.q_table[current_state]['value'] = value_for_money
                    self.q_table[current_state]['preference'] = preference_pattern
                    
                    # 레시피 최종 점수 업데이트
                    self.q_table[current_state][recipe_name] = new_value
                    
                    total_reward += total_reward_for_recipe
                
                if episode % 10 == 0:
                    print(f"Episode {episode}: 평균 보상 = {total_reward/len(recipes):.3f}")
                    
        except Exception as e:
            print(f"학습 중 오류 발생: {str(e)}")
            traceback.print_exc()


    def calculate_nutrition_balance(self, recipe):
        # 영양소 균형 점수 계산
        try:
            energy = float(recipe.get('INFO_ENG', 0))
            protein = float(recipe.get('INFO_PRO', 0))
            fat = float(recipe.get('INFO_FAT', 0))
            
            # 이상적인 영양 비율과의 차이 계산
            ideal_protein_ratio = 0.2  # 칼로리의 20%가 단백질
            ideal_fat_ratio = 0.3     # 칼로리의 30%가 지방
            
            actual_protein_ratio = (protein * 4) / energy if energy > 0 else 0
            actual_fat_ratio = (fat * 9) / energy if energy > 0 else 0
            
            balance_score = 1 - (
                abs(ideal_protein_ratio - actual_protein_ratio) +
                abs(ideal_fat_ratio - actual_fat_ratio)
            )
            
            return max(0, min(1, balance_score))
        except:
            return 0

    def calculate_value_for_money(self, recipe):
        # 가격 대비 영양가 점수 계산
        try:
            price = float(recipe.get('totalPrice', 0))
            energy = float(recipe.get('INFO_ENG', 0))
            protein = float(recipe.get('INFO_PRO', 0))
            
            if price <= 0:
                return 0
                
            # 1000원당 영양가 계산
            value_score = (energy/2000 + protein/50) / (price/1000)
            return max(0, min(1, value_score))
        except:
            return 0

    def analyze_preference_pattern(self, recipe):
        # 사용자 선호도 패턴 분석
        try:
            positive = float(recipe.get('positiveFeedbacks', 0))
            negative = float(recipe.get('negativeFeedbacks', 0))
            total = positive + negative
            
            if total == 0:
                return 0
                
            # 기본 선호도 점수
            base_score = positive / total
            
            # 피드백 수에 따른 가중치
            confidence = min(total / 10, 1.0)
            
            return base_score * confidence
        except:
            return 0

    def recommend(self):
        try:
            recipes = self.load_training_data()
            if not recipes:
                return "추천할 레시피가 없습니다."

            print(f"{len(recipes)}개의 레시피 중에서 추천을 시작합니다.")
            
            # 레시피 이름으로 그룹화하여 가장 높은 점수의 레시피만 선택
            recipe_scores_dict = {}
            for recipe in recipes:
                state = self.get_state(recipe)
                score = sum(self.q_table[state].values())
                recipe_name = recipe['RCP_NM']
                
                if recipe_name not in recipe_scores_dict or recipe_scores_dict[recipe_name]['score'] < score:
                    recipe_scores_dict[recipe_name] = {
                        'recipe': recipe,
                        'score': score
                    }
                print(f"레시피 '{recipe_name}' 점수: {score:.3f}")

            if not recipe_scores_dict:
                return "레시피 점수를 계산할 수 없습니다."

            # 점수 기준으로 정렬하고 상위 3개의 서로 다른 레시피 선택
            top_recipes = sorted(
                recipe_scores_dict.values(),
                key=lambda x: x['score'],
                reverse=True
            )[:3]
            
            # 결과 문자열 생성
            result = "=== 추천 레시피 TOP 3 ===\n\n"
            for i, item in enumerate(top_recipes, 1):
                recipe = item['recipe']
                result += f"{i}위: {recipe['RCP_NM']}\n"
                result += f"- 점수: {item['score']:.2f}\n"
                result += f"- 열량: {recipe.get('INFO_ENG', 'N/A')}kcal\n"
                result += f"- 단백질: {recipe.get('INFO_PRO', 'N/A')}g\n"
                result += f"- 지방: {recipe.get('INFO_FAT', 'N/A')}g\n"
                result += f"- 예상 가격: {format(int(recipe.get('totalPrice', 0)), ',')}원\n"
                result += f"- 좋아요: {recipe.get('positiveFeedbacks', 0)}개\n"
                result += f"- 싫어요: {recipe.get('negativeFeedbacks', 0)}개\n"
                result += "\n"

            return result

        except Exception as e:
            print(f"추천 중 오류 발생: {str(e)}")
            traceback.print_exc()
            return f"레시피 추천 중 오류가 발생했습니다: {str(e)}"

def main():
    try:
        print("레시피 추천 시스템을 시작합니다...")
        recommender = RecipeRecommender()
        print("추천 시스템이 초기화되었습니다.")
        
        print("학습을 시작합니다...")
        recommender.train()
        print("학습이 완료되었습니다.")
        
        print("추천을 시작합니다...")
        recommendation = recommender.recommend()
        print(recommendation)
        
    except Exception as e:
        print(f"치명적인 오류 발생: {str(e)}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        try:
            recommender.client.close()
            print("MongoDB 연결을 종료했습니다.")
        except:
            pass

if __name__ == "__main__":
    main()