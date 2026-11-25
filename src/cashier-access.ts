import {useLayoutEffect,useRef,type RefObject} from 'react';

type KeyEvent=Pick<KeyboardEvent,'key'|'altKey'|'ctrlKey'|'metaKey'|'shiftKey'|'repeat'|'isComposing'|'defaultPrevented'>;
type Context={page:string;modal:string;busy:boolean;blocked:boolean;canSell:boolean;cartSize:number;hasReceipt:boolean};
export function cashierShortcut(event:KeyEvent,context:Context){
 if(event.defaultPrevented||event.repeat||event.isComposing||event.altKey||event.shiftKey)return null;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){
  if(context.modal!=='receipt'||!context.hasReceipt)return null;
  return context.busy?'wait-print':'print';
 }
 if(event.ctrlKey||event.metaKey||context.page!=='pos'||context.modal||context.busy||context.blocked||!context.canSell)return null;
 switch(event.key){
  case 'F2':return 'search';
  case 'F4':return context.cartSize?'quantity':null;
  case 'F6':return 'customer';
  case 'F8':return 'discount';
  case 'F9':return context.cartSize?'payment':null;
  default:return null;
 }
}

export function focusControl(element:HTMLElement|null|undefined){
 if(!element?.isConnected||element.matches(':disabled')||!element.getClientRects().length)return false;
 element.focus();return document.activeElement===element;
}

export function useWorkspaceDialog(dialog:RefObject<HTMLDialogElement|null>,name:string,busy:boolean,returnTarget:RefObject<HTMLElement|null>){
 const previous=useRef(''),initial=useRef(false),returning=useRef(false),focused=useRef<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  const node=dialog.current;if(!node)return;
  if(name){
   if(previous.current!==name){initial.current=true;focused.current=null}
   previous.current=name;
   const title=node.querySelector<HTMLElement>('#workspace-dialog-title');
   const track=(event:FocusEvent)=>{if(event.target instanceof HTMLElement&&event.target!==title)focused.current=event.target};
   const containTab=(event:KeyboardEvent)=>{
    if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||event.defaultPrevented)return;
    const controls=Array.from(node.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,summary,[tabindex]')).filter(element=>element.tabIndex>=0&&!element.matches(':disabled')&&!!element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden');
    const active=document.activeElement;
    if(!controls.length){event.preventDefault();node.focus();return}
    if(!controls.includes(active as HTMLElement)||event.shiftKey&&active===controls[0]||!event.shiftKey&&active===controls[controls.length-1]){event.preventDefault();focusControl(event.shiftKey?controls[controls.length-1]:controls[0])}
   };
   node.addEventListener('focusin',track);
   node.addEventListener('keydown',containTab);
   if(!node.open)node.showModal();
   if(initial.current){
    if(busy)focusControl(title);
    else{
     const candidate=node.querySelector<HTMLElement>('[data-dialog-initial]:not(:disabled)')||node.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled)')||node.querySelector<HTMLElement>('[data-dialog-close]');
     if(!focusControl(candidate))node.focus();
     initial.current=false;
    }
   }else if(busy&&(!node.contains(document.activeElement)||focused.current?.matches(':disabled')))focusControl(title);
   else if(!busy&&document.activeElement===title)focusControl(focused.current);
   return()=>{node.removeEventListener('focusin',track);node.removeEventListener('keydown',containTab)};
  }else{
   previous.current='';initial.current=false;
   if(node.open){node.close();returning.current=true}
   if(returning.current&&!busy){
    if(!focusControl(returnTarget.current))focusControl(document.querySelector<HTMLElement>('#scan'))||focusControl(document.querySelector<HTMLElement>('#workspace-main'));
    returnTarget.current=null;returning.current=false;
   }
  }
 },[name,busy,dialog,returnTarget]);
}
