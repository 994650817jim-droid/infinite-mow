/** Chapter-one prop scale guide, in world pixels. Keep category proportions stable. */
export function propDisplaySize(frame:number):number {
 if(frame<4)return 146;
 if(frame<10)return 110;
 if(frame===10||frame===11)return 140;
 if(frame===12||frame===13)return 144;
 if(frame===14||frame===15)return 120;
 if(frame===16||frame===17)return 108;
 if(frame===18)return 96;
 if(frame>=19&&frame<=22)return 138;
 if(frame===23)return 120;
 if(frame===24||frame===25)return 132;
 if(frame>=26&&frame<=28)return 118;
 if(frame===35)return 92;
 return 108;
}
/** Mirroring baked-in highlights also mirrors the sun. Reserve it for flat cloth only. */
export function mayMirrorProp(frame:number):boolean {return frame>=4&&frame<=9;}
