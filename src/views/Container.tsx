import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  createContext,
  useContext,
  useCallback,
} from "react"
import { useMessages } from "./hooks/useMessages"
import { useDragging } from "./hooks/useDragging"
import { TestMenu } from "./features/menus/TestMenu"
import { ResearchAssistant } from "../models/assistant"
import {
  ClarificationActionResponse,
  ErrorActionResponse,
  ExecutorActionResponse,
} from "../models/utils/actions"
import { UserMessage } from "./features/message/UserMessage"
import { BotMessage } from "./features/message/BotMessage"
import { UserMessageProps } from "./features/message/types"
import { Header } from "./features/Header"
import { MainMenu } from "./features/menus/MainMenu"
import { Input } from "./features/input/Input"
import { Version } from "./components/Version"
import "./style.css"
import { States, areStatesEmpty, MentionValue } from "../models/utils/states"
import { Feedback } from "./features/Feedback"
import { useFeedback } from "./hooks/useFeedback"
import { InfoPanel } from "./features/infoPanel/InfoPanel"
import { PromptLibrary } from "./features/infoPanel/PromptLibrary"
import { FAQ } from "./features/infoPanel/FAQ"
import { config } from "../../package.json"
import { getPref, setPref } from "../utils/prefs"
import { debounce, set } from "lodash"
import { useZoom } from "./hooks/useZoom"
import { useNotification } from "./hooks/useNotification"
import { useAssistant } from "./hooks/useAssistant"
import { useScroll } from "./hooks/useScroll"
import { AssistantStream } from "openai/lib/AssistantStream"
import { useFunctionCalls } from "./hooks/useFunctionCalls"
import { nestedSearch } from "../apis/zotero/search"
import { SearchStrategy } from "./components/visuals/SearchStrategy"

interface UserInput {
  content: MentionValue
  states: States
}

export function Container() {
  const zoom = useZoom()
  const { notification, hasNotification } = useNotification()
  const [userInput, setUserInput] = useState<UserInput>()
  const { isDragging, setIsDragging } = useDragging()
  const {
    messages,
    addMessage,
    editMessage,
    updateMessage,
    clearMessages,
    initMessage,
    persistMessage,
  } = useMessages()
  const { submitFeedback, openFeedback, setOpenFeedback, submitCallback } =
    useFeedback()
  const [promptTemplate, setPromptTemplate] = useState<
    { template: string } | undefined
  >()
  const [isLoading, setIsLoading] = useState(false)
  const [copyId, setCopyId] = useState<string>()
  const [editId, setEditId] = useState<string | undefined>()
  const containerRef = useRef<HTMLDivElement>(null)
  const { assistant } = useAssistant()
  const {
    functionCalls,
    functionCallsFulfilled,
    setFunctionCalls,
    setFunctionCallsCount,
    addFunctionCallOutput,
    clearFunctionCalls,
  } = useFunctionCalls()
  const { scrollToEnd, pauseScroll, resumeScroll } = useScroll(containerRef)

  useEffect(() => {
    scrollToEnd()
  }, [])

  useEffect(() => {
    console.log("tool stream check")
    console.log({ functionCalls, fullfilled: functionCallsFulfilled() })
    if (functionCallsFulfilled()) {
      console.log("tool stream begin")
      const stream = assistant.streamTools(functionCalls)
      clearFunctionCalls()
      initMessage({
        type: "BOT_MESSAGE",
        stream: stream,
        messageSlice: messages,
        scrollToEnd: scrollToEnd,
        persistMessage,
      })
    }
  }, [functionCalls, functionCallsFulfilled, clearFunctionCalls])

  // useEffect(() => {
  //   function handleAction(
  //     {
  //       action,
  //       payload,
  //     }:
  //       | ClarificationActionResponse
  //       | ErrorActionResponse
  //       | ExecutorActionResponse,
  //     isSubscribed: boolean,
  //   ) {
  //     if (!isSubscribed) {
  //       return
  //     }
  //     switch (action) {
  //       case "clarification": {
  //         const { message, _raw } = payload
  //         const newBotMessage = {
  //           type: "BOT_MESSAGE" as const,
  //           widget: "MARKDOWN" as const,
  //           input: {
  //             content: message,
  //           },
  //           _raw,
  //         }
  //         return addMessage(newBotMessage)
  //       }
  //       case "error": {
  //         const { error, _raw } = payload
  //         const newBotMessage = {
  //           type: "BOT_MESSAGE" as const,
  //           widget: "ERROR" as const,
  //           input: {
  //             error,
  //           },
  //           _raw,
  //         }
  //         return addMessage(newBotMessage)
  //       }
  //       default: {
  //         const { widget, input, _raw } = payload
  //         const newBotMessage = {
  //           type: "BOT_MESSAGE" as const,
  //           widget,
  //           input: input as LegacyBotMessageProps["input"],
  //           _raw,
  //         }
  //         return addMessage(newBotMessage)
  //       }
  //     }
  //   }
  //   let isSubscribed = true
  //   if (userInput) {
  //     const stream = assistant.stream(
  //       userInput.content.newValue,
  //       userInput.states,
  //     )
  //     initMessage({
  //       type: "BOT_STREAM_MESSAGE",
  //       stream: stream,
  //       messageSlice: messages,
  //       scrollToEnd: scrollToEnd,
  //       persistMessage,
  //     })
  //   }
  //   return () => {
  //     isSubscribed = false
  //   }
  // }, [userInput])

  async function handleSubmit(
    input: { content: MentionValue; states: States },
    id?: string,
  ) {
    const { content, states } = input
    const newUserMessage = {
      type: "USER_MESSAGE" as const,
      content,
      states,
    }
    addMessage(newUserMessage)
    const stream = assistant.streamMessage(content.newValue, states)

    initMessage({
      type: "BOT_MESSAGE",
      stream: stream,
      messageSlice: messages,
      scrollToEnd: scrollToEnd,
      persistMessage,
    })
    scrollToEnd()
    // if (id) {
    //   const updatedUserMessage = {
    //     type: "USER_MESSAGE" as const,
    //     id,
    //     content,
    //     states,
    //   }
    //   // legacyAssistant.rebuildMemory(updateMessage(updatedUserMessage))
    //   setUserInput({ content, states })
    // } else {
    //   const newUserMessage = {
    //     type: "USER_MESSAGE" as const,
    //     content,
    //     states,
    //   }

    //   addMessage(newUserMessage)

    //   if (isLoading) {
    //     // If either the older or the newer message has empty states (and therefore mentions), their text contents are merged and the non-empty states/mentions are kept. Otherwise the older message is discarded.
    //     if (!userInput?.states || areStatesEmpty(userInput.states)) {
    //       const previousValue = userInput?.content
    //         ? userInput.content.newValue + "\n"
    //         : ""
    //       const previousPlainTextValue = userInput?.content
    //         ? userInput.content.newPlainTextValue + "\n"
    //         : ""
    //       const mergedContent = {
    //         newValue: previousValue + content.newValue,
    //         newPlainTextValue:
    //           previousPlainTextValue + content.newPlainTextValue,
    //         mentions: content.mentions.map((mention) => ({
    //           ...mention,
    //           index: mention.index + previousValue.length + 1,
    //           plainTextIndex:
    //             mention.plainTextIndex + previousPlainTextValue.length + 1,
    //         })),
    //       }
    //       setUserInput({ content: mergedContent, states })
    //     } else if (areStatesEmpty(states)) {
    //       const mergedContent = {
    //         newValue: userInput.content.newValue + "\n" + content.newValue,
    //         newPlainTextValue:
    //           userInput.content.newPlainTextValue +
    //           "\n" +
    //           content.newPlainTextValue,
    //         mentions: userInput.content.mentions,
    //       }
    //       setUserInput({ content: mergedContent, states: userInput.states })
    //     } else {
    //       setUserInput({ content, states })
    //     }
    //   } else {
    //     setUserInput({ content, states })
    //   }
    // }
  }

  async function handleTest() {
    // const vectorStoreId = "vs_laVIcRUhlhqe7acRHsgIenL8"
    // console.log({ form: new FormData(), type: typeof FormData })
    // const item = await Zotero.Items.getAsync(120)
    // console.log("item", item.getDisplayTitle())
    // const attachment = (await item.getBestAttachment()) as Zotero.Item
    // console.log("attachment file name", attachment.attachmentFilename)
    // const fileId = await assistant.uploadFile(item, attachment, "assistants")
    // await assistant.indexFile(item, fileId, vectorStoreId)
    // console.log("item", ztoolkit.ExtraField.getExtraFields(item))
    const stream = assistant.streamQa("How to use LLM for taxonomy building?")
    stream.on("messageDelta", (_delta: any, snapshot: any) => {
      console.log("messageDelta", snapshot.content[0].text)
    })
  }

  const query = {
    boolean: "AND",
    subqueries: [
      {
        boolean: "OR",
        subqueries: [
          {
            conditions: [
              {
                condition: "creator",
                operator: "is",
                value: "Andrew D. White",
              },
              {
                condition: "creator",
                operator: "is",
                value: "Andrew White",
              },
            ],
            match: "any",
            title: "Creator: Andrew D. White or Andrew White",
          },
          {
            conditions: [
              {
                condition: "tag",
                operator: "contains",
                value: "LLMs",
              },
              {
                condition: "tag",
                operator: "contains",
                value: "chemistry",
              },
              {
                condition: "tag",
                operator: "contains",
                value: "digital chemistry",
              },
            ],
            match: "any",
            title: "Tags: LLMs, chemistry, or digital chemistry",
          },
          {
            conditions: [
              {
                condition: "tag",
                operator: "doesNotContain",
                value: "materials science",
              },
            ],
            match: "all",
            title: "Exclude: Materials Science",
          },
        ],
      },
      {
        conditions: [
          {
            condition: "tag",
            operator: "contains",
            value: "LLMs",
          },
          {
            condition: "tag",
            operator: "contains",
            value: "chemistry",
          },
          {
            condition: "tag",
            operator: "contains",
            value: "digital chemistry",
          },
        ],
        match: "any",
        title: "Tags: LLMs, chemistry, or digital chemistry",
      },
      {
        conditions: [
          {
            condition: "tag",
            operator: "doesNotContain",
            value: "materials science",
          },
        ],
        match: "all",
        title: "Exclude: Materials Science",
      },
    ],
  }

  return (
    <div
      className="fixed m-0 h-full px-3 bg-gradient-170 from-red-50 to-blue-50 flex flex-col"
      style={zoom.style}
      onDragEnter={() => setIsDragging(isDragging + 1)}
      onDragLeave={() => setIsDragging(isDragging - 1)}
    >
      {notification}
      <div
        className={`w-full flex-auto mb-4 overflow-x-hidden overflow-y-scroll flex flex-col justify-start`}
        ref={containerRef}
      >
        <Header />
        <button onClick={handleTest}>Test</button>
        <div className="bg-white p-2 border border-neutral-500 rounded shadow-md text-black break-words">
          <SearchStrategy query={query} />
        </div>
        <MainMenu
          containerRef={containerRef}
          resetMemory={assistant.resetMemory}
          messages={messages}
          clearMessages={clearMessages}
          zoom={zoom}
          hasNotification={hasNotification}
        />
        {__env__ === "development" ? (
          <TestMenu
            setUserInput={setUserInput}
            addMessage={addMessage}
            hasNotification={hasNotification}
          />
        ) : null}
        <InfoPanel
          promptLibrary={
            <PromptLibrary setPromptTemplate={setPromptTemplate} />
          }
          faq={<FAQ />}
        />
        {messages.map((message, index) => {
          switch (message.type) {
            case "USER_MESSAGE": {
              const {
                copyId: _1,
                setCopyId: _2,
                editId: _3,
                setEditId: _4,
                ...props
              } = message
              return (
                <UserMessage
                  key={props.id}
                  copyId={copyId}
                  setCopyId={setCopyId}
                  editId={editId}
                  setEditId={setEditId}
                  setPromptTemplate={setPromptTemplate}
                  {...(props as Omit<
                    UserMessageProps,
                    | "copyId"
                    | "setCopyId"
                    | "editId"
                    | "setEditId"
                    | "setPromptTemplate"
                  >)}
                  onSubmit={handleSubmit}
                />
              )
            }
            case "BOT_MESSAGE": {
              const { copyId: _1, setCopyId: _2, ...props } = message
              return (
                <BotMessage
                  key={props.id}
                  copyId={copyId}
                  setCopyId={setCopyId}
                  setFunctionCallsCount={setFunctionCallsCount}
                  addFunctionCallOutput={addFunctionCallOutput}
                  {...(props as any)}
                  scrollToEnd={scrollToEnd}
                  pauseScroll={pauseScroll}
                  resumeScroll={resumeScroll}
                />
              )
            }
          }
        })}
      </div>
      <div className="flex-initial">
        {/* {isLoading ? (
          <div className="absolute right-10 pt-4 z-10">
            <div className="dot-flashing "></div>
          </div>
        ) : null} */}
        <div className="bottom-6 w-full z-40 m-0 mb-4">
          <Input
            disabled={editId !== undefined}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            promptTemplate={promptTemplate}
            setPromptTemplate={setPromptTemplate}
          />
        </div>
        {/* <Version /> */}
      </div>
      <Feedback
        open={openFeedback}
        setOpen={setOpenFeedback}
        callback={submitCallback}
      />
    </div>
  )
}
