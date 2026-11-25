export function assertSchemaCompatible(available:readonly string[],applied:readonly string[]){
 const known=new Set(available),unknown=applied.filter(version=>!known.has(version));
 if(unknown.length)throw Error('Database contains migrations unknown to this release. Startup refused; use a compatible release or an independently verified recovery plan.');
 const sorted=[...available].sort(),done=new Set(applied);let gap=false;
 for(const version of sorted){if(!done.has(version))gap=true;else if(gap)throw Error('Database migration history is not a prefix of this release. Startup refused.');}
}
