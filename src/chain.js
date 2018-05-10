class chain {
    constructor(log, firebase) {
        this.log_id = log.id
        this.log_path = `/logs/${this.log_id}`
        this.firebase = firebase
    }

    append(log) {
        this.firebase
            .database()
            .ref(`${this.log_path}/chain`)
            .push(log.id, () => {
                this.firebase.database().goOffline()
            })
    }
}

module.exports = chain