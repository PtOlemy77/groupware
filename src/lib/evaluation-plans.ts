import type { PerformanceGoal, EvaluationPlanState } from '@/types/evaluation-plans';
export const EVALUATION_STATES:Record<EvaluationPlanState,string>={DRAFT:'목표 작성중',SUBMITTED:'목표 검토대기',REVISION_REQUIRED:'목표 보완요청',APPROVED:'목표 승인 · 실적 작성',RESULT_REVISION_REQUIRED:'실적 보완요청',RESULT_SUBMITTED:'실적 평가대기',EVALUATED:'평가 확정'};
export function goalTemplates(kind:'PROJECT'|'POOL'):PerformanceGoal[] {
  const rows=kind==='PROJECT' ? [['WORK','직무 성과',35,'%'],['SCHEDULE','업무 일정 준수',35,'%'],['COLLABORATION','근태·커뮤니케이션·자기개발',30,'%']] : [['SCHEDULE','일정 준수',10,'%'],['PLAN_REPORT','계획 및 보고',10,'%'],['COMMUNICATION','의사소통',10,'%'],['DEVELOPMENT','자기개발',10,'시간'],['COMPLIANCE','규정 준수',10,'%']];
  return rows.map(([category,title,weight,unit],i)=>({id:`goal-${i+1}`,category:String(category),title:String(title),criterion:'',direction:'HIGHER',target:unit==='%'?100:0,unit:String(unit),weight:Number(weight)}));
}
export function planMonths(start:string,end:string):string[] {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return [];
  const first=Number(start.slice(0,4))*12+Number(start.slice(5,7))-1,last=Number(end.slice(0,4))*12+Number(end.slice(5,7))-1;
  if(last-first>23)return [];
  return Array.from({length:last-first+1},(_,i)=>`${Math.floor((first+i)/12)}-${String((first+i)%12+1).padStart(2,'0')}`);
}
export function achievement(goal:PerformanceGoal,actual:number|null):number|null {
  if(actual===null||goal.direction==='MANUAL')return null;
  const score=goal.direction==='LOWER' ? actual<=goal.target?100:goal.target===0?0:goal.target/actual*100 : goal.target>0?Math.min(100,actual/goal.target*100):null;
  return score===null?null:Math.round(score*100)/100;
}
export const goalsEditable=(state:EvaluationPlanState)=>state==='DRAFT'||state==='REVISION_REQUIRED';
export const resultsEditable=(state:EvaluationPlanState)=>state==='APPROVED'||state==='RESULT_REVISION_REQUIRED';
