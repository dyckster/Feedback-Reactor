module.exports = {
    getPrettyFeedbackNameForType: function (feedbackType) {
        if (feedbackType === 'FEEDBACK') {
            return "Feedback"
        } else if (feedbackType === 'IDEA') {
            return "Idea"
        } else if (feedbackType === 'BUG_REPORT' || feedbackType === 'BUG') {
            return "Bug report"
        } else if (feedbackType === 'TRANSLATION') {
            return "Translation"
        } else {
            return "Unknown"
        }
    },
    getPrettyFeedbackDescription: function (feedback) {
        return `
    ${fillUserSection(feedback)}
    📋 **Message:**
    ${feedback.description}

    **App version:** ${feedback.version}
    **Language:** ${feedback.language}
    **System Info:**
    ${feedback.systemInfo}
    `
    }
}

function fillUserSection(feedback) {
    let userSection = "";
    if (feedback.email) {
        userSection += `\n📧 **Email: ${feedback.email}**`
    }
    return userSection
}
