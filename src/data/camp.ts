export const CAMP_TRAINING={hp:{name:'体魄训练',perLevel:.08,costs:[20,35,55]},attack:{name:'兵刃训练',perLevel:.06,costs:[20,35,55]},armor:{name:'甲胄训练',perLevel:.05,costs:[20,35,55]}} as const;
export type CampTrainingId=keyof typeof CAMP_TRAINING;
export type CampTraining=Record<CampTrainingId,number>;
export const freshTraining=():CampTraining=>({hp:0,attack:0,armor:0});
export type CampGroup='front'|'middle'|'rear';
