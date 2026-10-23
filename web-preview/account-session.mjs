// A profile/server error must remain visible, never become a login redirect loop.
export async function readAccountSession(fetcher=fetch) {
  const options={credentials:'same-origin',cache:'no-store'};
  const response=await fetcher('/api/auth/me',options);
  if(response.status===401)return null;
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('계정 서버 응답을 확인할 수 없습니다. 게임 서버를 다시 실행해 주세요.');
  const {user}=await response.json();if(!user)return null;
  const profileResponse=await fetcher('/api/player/profile',options);
  if(profileResponse.status===401)return null;
  if(profileResponse.status===404)throw new Error('이전 임시 서버가 실행 중입니다. 영구 DB 게임 서버로 다시 실행해 주세요.');
  if(!profileResponse.ok||!profileResponse.headers.get('content-type')?.includes('application/json'))throw new Error('로그인은 되었지만 유저 DB를 불러오지 못했습니다. 계정 서버를 확인해 주세요.');
  return {user,profile:await profileResponse.json()};
}
