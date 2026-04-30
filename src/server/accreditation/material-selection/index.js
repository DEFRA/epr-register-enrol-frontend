import {
  materialSelectionGetController,
  materialSelectionPostController
} from './controller.js'

export const materialSelection = {
  plugin: {
    name: 'material-selection',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accreditation/material-selection',
          ...materialSelectionGetController
        },
        {
          method: 'GET',
          path: '/{language}/accreditation/material-selection',
          ...materialSelectionGetController
        },
        {
          method: 'POST',
          path: '/accreditation/material-selection',
          ...materialSelectionPostController
        },
        {
          method: 'POST',
          path: '/{language}/accreditation/material-selection',
          ...materialSelectionPostController
        }
      ])
    }
  }
}
