export const isManagementOperation=operation=>typeof operation==='string'&&operation.startsWith('management');

// Use a server-configured identity and the authenticated role, never a display name.
export function canAccessManagement(user,configuredEmail){
 return !!user&&user.role==='admin'&&typeof configuredEmail==='string'&&configuredEmail.trim()!==''&&user.email.toLowerCase()===configuredEmail.trim().toLowerCase();
}
export function visibleState(state,allowed){
 if(allowed||!state)return state;
 return Object.fromEntries(Object.entries(state).filter(([key])=>!key.startsWith('management')));
}
