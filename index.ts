import { ChannelType, Collection, Events, TextChannel } from "discord.js"
import { Client, Message, MessageAttachment, MessageManager, type MessageSearchOptions } from "discord.js-selfbot-v13"
import { createWriteStream, existsSync } from "fs"
import { mkdir } from "fs/promises"
import fetch from "node-fetch"
import { join } from "path"

console.log("Archive-X started\n")
console.log("Created by lanjt")
const client = new Client()

// Config
const RATELIMIT_DELAY = 300 // How much time (in milliseconds) the program will sleep before attempting to hit the API again
const OUTPUT_DIR = "./outputFiles" // The directory where the dump will be placed
const AUTHORIZED_USER = "498984530968051713" // Put the ID here that you want to be able to run "!archive"
const MAX_COLLECTED_MESSAGES = 50 // How many messages the program will resolve per session before it quits. Use `0` for no maximum limit. Anything over 500 may be severely bad for storage.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let globalMessageHitCount = 0

async function recursiveResolveMessages(channelMessages: MessageManager, offset?: number): Promise<Collection<string, any>> {
	if (!offset || offset < 1) {
		await channelMessages.channel.fetch()
		await channelMessages.fetch()
	}
	console.log(`Starting new recursive resolution with offset ${offset ?? 0}`)
	console.log(`Messages collected thus far: ${globalMessageHitCount}`)
	const thisSearchResult = await channelMessages.search(({
		limit: 25,
		offset: offset ?? 0,
		channels: [channelMessages.channel]
	}) as MessageSearchOptions)

	if (!thisSearchResult) {
		console.log('Search result not found')
		return new Collection()
	}
	if (thisSearchResult.messages.size >= 25) {
		globalMessageHitCount += 25
		if ((MAX_COLLECTED_MESSAGES > 0) && (globalMessageHitCount >= MAX_COLLECTED_MESSAGES)) {
			console.warn(`Forcefully quit resolving messages -- MAX_COLLECTED_MESSAGES reached (${MAX_COLLECTED_MESSAGES})`)
			return new Collection(thisSearchResult.messages)
		}
		const thisCollection = new Collection(thisSearchResult.messages)
		// Sleep
		await sleep(RATELIMIT_DELAY)
		const other = await recursiveResolveMessages(channelMessages, (offset ?? 0) + 25)
		for (const msgObject of other) {
			const id = msgObject[0]
			const msg = msgObject[1]

			thisCollection.set(id, msg)
		}
		return thisCollection
	} else {
		console.log('under25')
		return thisSearchResult.messages
	}
}

function getFormattedDate(date: Date) {
    var month: string | number = date.getMonth() + 1
    var day: string | number = date.getDate()
    var hour: string | number = date.getHours()
    var min: string | number = date.getMinutes()
    var sec: string | number = date.getSeconds()

    month = (month < 10 ? "0" : "") + month
    day = (day < 10 ? "0" : "") + day
    hour = (hour < 10 ? "0" : "") + hour
    min = (min < 10 ? "0" : "") + min
    sec = (sec < 10 ? "0" : "") + sec

    var str = date.getFullYear() + "-" + month + "-" + day + "_" +  hour + ":" + min + ":" + sec

    return str
}

client.on(Events.ClientReady, (c) => {
	console.log(`${client.user?.username} is ready! Run !archive in a channel.`)
})

client.on(Events.MessageCreate, async (m) => {
	if (m.author.id !== AUTHORIZED_USER)
		return;
	if (m.content.startsWith("!archive")) {
		globalMessageHitCount = 0
		const ARCHIVING_GUILD = m.guildId!
		const ARCHIVING_CHANNEL = m.channelId!
		await m.delete().catch((err)=>{})
		console.log(`Starting access attempt to ${ARCHIVING_GUILD}:${ARCHIVING_CHANNEL} for archiving...`)
		const guildResolved = await client.guilds.fetch(ARCHIVING_GUILD).catch((err)=>{
			console.error(`Failed to resolve guild ${ARCHIVING_GUILD}:\n\n${err}`)
			return
		})
		if (!guildResolved) {
			console.error(`Failed to resolve guild ${ARCHIVING_GUILD} for an unknown reason`)
			return
		}
		if (!guildResolved.available) {
			console.error(`Resolved guild ${ARCHIVING_GUILD}, but it is not available for operations.`)
			return
		}
		let channelResolved = await guildResolved.channels.fetch(ARCHIVING_CHANNEL).catch((err)=>{
			console.error(`Failed to resolve channel ${ARCHIVING_GUILD}:${ARCHIVING_CHANNEL}:\n\n${err}`)
			return
		})
		if (!channelResolved) {
			console.error(`Failed to resolve chanel ${ARCHIVING_GUILD}:${ARCHIVING_CHANNEL} for an unknown reason`)
			return
		}
		channelResolved = await channelResolved?.fetch()
		if (!channelResolved.isText()) {
			console.error(`Resolved channel ${ARCHIVING_GUILD}:${ARCHIVING_CHANNEL} is not a text channel. Breaking...`)
			return
		}

		
		let resolvedMessages = await recursiveResolveMessages(channelResolved.messages)
		console.log(`RESOLVED!`)
		console.log(`Resolved ${resolvedMessages.size} total messages from channel ${guildResolved.name}:${channelResolved.name} from path ${ARCHIVING_GUILD}:${ARCHIVING_CHANNEL}`)

		const FINAL_PATH = join(OUTPUT_DIR, `${guildResolved.name}-${channelResolved.name}`)
		if (!existsSync(FINAL_PATH)) {
			await mkdir(FINAL_PATH)
		}

		console.log(`Attempting to save images...`)
		if (!existsSync(join(FINAL_PATH, "images"))) {
			await mkdir(join(FINAL_PATH, "images"))
		}
		console.log('Created images directory')

		
		for (const filteredObj of resolvedMessages.filter((msg: Message, id)=>{
			const subFilterImages = msg.attachments.filter((attachment, id) => {
				return attachment.contentType?.match(/^image/g) !== null
			})
			return subFilterImages.size >= 1
		})) {
			// filteredObj[0] = id
			// filteredObj[1] = message

			const attachments = filteredObj[1].attachments
			for (const attachmentF of attachments) {
				const attachmentId = attachmentF[0]
				const attachment = attachmentF[1]
				// fetch the image and write to file
				console.log(`Writing attachment with name ${attachment.name} to ${join(FINAL_PATH, `images`, `${(attachment as MessageAttachment).id}.${(attachment as MessageAttachment).contentType?.split("/")[1]}`)}`)
				const img = await fetch(attachment.url)
				if (img.ok) {
					const writeStream = createWriteStream(join(FINAL_PATH, `images`, `${(attachment as MessageAttachment).id}.${(attachment as MessageAttachment).contentType?.split("/")[1]}`))
					img.body?.pipe(writeStream)
				}
			}

		}

		console.log(`Attempting to write file results to ${OUTPUT_DIR}/${guildResolved.name}-${channelResolved.name}...`)
		let textFile = `Archive-X created by lanjt\n`
		textFile += "\n--- START ARCHIVE METADATA ---\n"
		textFile += `Archive guild: ${guildResolved.name} (${ARCHIVING_GUILD})\nArchive channel: ${channelResolved.name} (${ARCHIVING_CHANNEL})\nArchive size: ${resolvedMessages.size} messages\n`
		textFile += "--- END ARCHIVE METADATA ---\n"
		textFile += "--- START ARCHIVE CONTENT ---"

		const reversedMessagesArray: [string, Message][] = Array.from(resolvedMessages.entries()).reverse();
		const newCol = new Collection<string, Message>()
		let index = 0
		for (let [messageId, message] of reversedMessagesArray) {
			// const messageId = resolvedMessage[0]
			// let message: Message = resolvedMessage[1]
			// message = await message.fetch()
			newCol.set(messageId, message)

			textFile += `\n\n<MessageId ${messageId}>`
			if (message.reference) {
				textFile += ` ~ Replied to: <MessageID ${message.reference.messageId}>`
			}
			textFile += `\n${message.member?.nickname ?? message.member?.displayName ?? message.author.displayName} (${message.author.username}) (${message.author.id}) at ${getFormattedDate(message.createdAt)} EST`
			if (message.content && message.content.length >= 1) {
				textFile += `\n\t${message.content.replaceAll('\n', `\n\t`)}`
			}
			if (message.attachments && message.attachments.size >= 1) {
				for (const attachmentObj of message.attachments) {
					// id = 0
					// attachment = 1

					textFile += `\n\t![IMAGE] ~ This image can be viewed under archiveRoot/images/${attachmentObj[1].id}.${attachmentObj[1].contentType?.split("/")[1]}`
				}
			}
			if (message.embeds && message.embeds.length >= 1) {
				let i = 0
				for (const embed of message.embeds) {
					textFile += `\Embed #${i+1}/${message.embeds.length}`
					textFile += `\n\t# ${embed.title ?? "No Title"}`
					textFile += `\n\t${(embed.description ?? "No Description").replaceAll('\n', '\n\t')}`
					if (embed.fields) {
						let fieldsI = 0
						for (const field of embed.fields) {
							textFile += `\n\tField #${fieldsI+1}/${embed.fields.length}`
							textFile += `\n\t\t# ${field.name ?? "No Field Name"}`
							textFile += `\n\t\t\t${(field.value ?? "No Field Value").replaceAll('\n', '\n\t\t\t')}`
							fieldsI++
						}
					}
					i++
				}
			}

			console.log(`Message parsing progress: ${Math.ceil((index/reversedMessagesArray.length) * 100)}%`)

			index++
		}

		textFile += "\n--- END ARCHIVE CONTENT ---"

		await Bun.write(join(FINAL_PATH, 'messages.txt'), textFile).then(()=>{
			console.log(`Wrote message contents file to ${join(FINAL_PATH, 'messages.txt')}`)
		}).catch((reason)=>{
			console.error(reason)
		})

		console.log('!! FINISHED ARCHIVING')
	}
})

client.login(process.env.TOKEN)