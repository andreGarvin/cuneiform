const firebase = require('firebase')

const asmany = require('asmany')

const chain = require('./src/chain')

const uuid = () => {
    return asmany(data => {
        return data += `${Math.random().toString(16).slice(2)}-`
    }, 3, '').slice(0, -1)
}

function getShortStackTrace(stack) {
    stack = stack
        .split('\n')
        .map(i => i.trim())
    
    const short_stack = []
    let i = 0
    const frag = 'at Object.<anonymous>'
    const frag_len = frag.length
    while (stack[i].slice(0, frag_len) !== frag) {
        i++
        short_stack.push(stack[i])
    }
    return short_stack.join('\n')
}

class cuneiform {
    constructor(params) {
        this.params = params

        this.firebase = firebase.initializeApp(this.params.firebase);

        this.levels = [
            'info', 'debug',
            'warning', 'error',
            'request'
        ]

        this.formatterFunc = undefined
        this.middlewareFunc = undefined
    }

    formatter(formatterFunc) {
        this.formatterFunc = formatterFunc
    }

    middleware(middlewareFunc) {
        this.middlewareFunc = middlewareFunc
    }

    triggerMiddileware(log) {
        return this.middlewareFunc(log)
    }

    chain(log) {
        return new chain(log, this.firebase)
    }

    info(message) {
        return this.send(
            'info',
            message
        )
    }

    warning({ message, warning }) {
        return this.send(
            'warning',
            { message, warning }
        )
    }

    debug(val) {
        return this.send(
            'debug',
            val
        )
    }

    format(input) {
        const { level, message } = input

        if (this.formatterFunc) {
            return this.formatterFunc(level, message)
        }

        if (typeof o === 'object' && Array.isArray(o)) {
            message = JSON.stringify(message)
        }

        const paramsClone = this.params
        delete paramsClone.key
        delete paramsClone.firebase
        return {
            ...paramsClone,
            ...input,
            level,
            message,
            time_stamp: Date(),
            id: uuid()
        }
    }

    error(error = undefined) {
        if ( (error instanceof Error) ) {
            const { message, name, stack } = error
            
            return this.send(
                'error',
                {
                    name,
                    message,
                    stack: {
                        full: stack,
                        short: getShortStackTrace(stack)
                    }
                },
                false
            )
        }
    }

    logRequest(req) {
        const { headers, httpVersion, body, method, url, connection } = req
        const { protocol, pathname, search, port, query, hash } = require('url').parse(url, true)

        const request_log = {
            uri: url,
            hash,
            query,
            search,
            pathname,
            level: 'request',
            headers: headers,
            body: (body || {}),
            http_version: httpVersion,
            protocol: (protocol || ''),
            method: method.toUpperCase(),
            time_out: connection.server.timeout,
            message: `Recieved a request on ${pathname}`,
            keep_alive_timeout: connection.server.keepAliveTimeout,
        }

        return this.send(
            'request',
            this.format(request_log),
            false
        )
    }

    send(level = 'info', message = undefined, format = true) {
        if (this.levels.includes(level)) {
            let formatted_log;

            if (format) {
                formatted_log = this.format({ level, message })
            }
            
            if ( !format && message.id === undefined) {
                message.id = uuid()
            }

            try {
                if (this.triggerMiddileware) {
                    this.triggerMiddileware(formatted_log)
                }
            } catch (err) {
                const ref = `/logs/${(format ? formatted_log.id : message.id)}`
                this.firebase
                    .database()
                    .ref(ref)
                    .set((format ? formatted_log : message), () => {
                        this.firebase.database().goOffline()
                    })
                return (format ? formatted_log : message);
            }

            const ref = `/logs/${(format ? formatted_log.id : message.id)}`
            this.firebase
                .database()
                .ref(ref)
                .set((format ? formatted_log : message), () => {
                    this.firebase.database().goOffline()
                })
            return (format ? formatted_log : message)
        } else {
            return this.warning({ message, warning: `WARNING: level '${level}' is not defined or constructed` })
        }
    }
}

module.exports = cuneiform