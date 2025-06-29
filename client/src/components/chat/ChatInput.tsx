import React, { useEffect, useRef, useState } from 'react'
import { Textarea } from '../ui/textarea';

interface ChatInputProps{
  onSubmit:(message:string)=>void;
  isLoading:boolean
}
const ChatInput = ({onSubmit,isLoading}:ChatInputProps) => {
  const[input,setInput]= useState("");
  const textareaRef= useRef<HTMLTextAreaElement>(null);
  const[isSpeechActive, setIsSpeechActive]= useState(false);

  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(input.trim()){
      onSubmit(input);
      setInput("");
    }
  }

  const handleKeyDown=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      handleSubmit(e);
    }
  }

  useEffect(()=>{
    const textarea=textareaRef.current;
    if(textarea){
      textarea.style.height="auto";
      textarea.style.height= `${Math.min(textarea.scrollHeight,150)}px`
    }
  },[input])

  return (
    <div>
      <div className={`w-full max-w-4xl md:ml-64 rounded-xl bg-[#f4f4f6] py-4 px-4 shadow-[0_-1px_6px_RGBA(0,0,0,0.05)]`}>
        <form onSubmit={handleSubmit} className='w-full'>
          <Textarea
          ref={textareaRef}
          placeholder=''
          />
        </form>
      </div>
    </div>
  )
}

export default ChatInput
